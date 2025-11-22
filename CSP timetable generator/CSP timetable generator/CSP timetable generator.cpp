#include "httplib.h"
#include <nlohmann/json.hpp>
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <iomanip>
#include <chrono>
#include <stack>

using json = nlohmann::json;
using namespace httplib;
using namespace std;

struct Course {
    string courseID, courseName, type;
    string labType;
    int duration;
    bool allYear;
};

struct Instructor {
    string instructorID, name;
    vector<string> qualifiedCourses;
    vector<int> preferredTimeSlots;
    vector<int> unavailableTimeSlots;
};

struct TA {
    string taID, name;
    vector<string> qualifiedCourses;
    vector<int> preferredTimeSlots;
    vector<int> unavailableTimeSlots;
};

struct Room {
    string roomID, type;
    string labType;
    int capacity;
};

struct Section {
    string sectionID, groupID;
    int year, studentCount;
    vector<string> assignedCourses;
};

struct Slot {
    string courseID;
    string type;
    string roomID;
    string instructorID;
    int duration;
    bool istaken;
    bool isCont;

    Slot() : duration(0), istaken(false), isCont(false) {}
};

struct CSPVariable {
    int id;
    string courseID;
    vector<int> targetSectionIndices;
    int totalStudents;

    int duration;
    int availableInstructorsCount;
    bool isHardConstraint;
};


struct CSPValue {
    int startSlot;
    string instructorID;
    string roomID;
};

vector<Course> courses;
vector<Instructor> instructors;
vector<TA> tas;
vector<Room> rooms;
vector<Section> sections;

const int SLOTS_MAX = 40;
int SECTIONS_MAX;
vector<vector<Slot>> Timetable;

unordered_map<string, int> sectionToIndex;
unordered_map<string, vector<int>> groupToSectionIndices;
unordered_map<string, Course> getCourse;

unordered_set<string> instructorBusy[SLOTS_MAX];
unordered_set<string> roomBusy[SLOTS_MAX];
vector<unordered_set<string>> sectionScheduledCourses;

string lastError = "";
int iterationCount = 0;
const int MAX_ITERATIONS = 5000000;
auto startTime = chrono::steady_clock::now();

string getInstructorName(string instructorID) {
    for (auto& inst : instructors) if (inst.instructorID == instructorID) return inst.name;
    for (auto& ta : tas) if (ta.taID == instructorID) return ta.name;
    return "";
}

bool isInstructorAvailable(string instructorID, int slot) {
    if (instructorBusy[slot].count(instructorID)) return false;

    for (auto& inst : instructors) {
        if (inst.instructorID == instructorID) {
            for (int s : inst.unavailableTimeSlots) if (s == slot) return false;
            return true;
        }
    }
    for (auto& ta : tas) {
        if (ta.taID == instructorID) {
            for (int s : ta.unavailableTimeSlots) if (s == slot) return false;
            return true;
        }
    }
    return true;
}

bool isQualified(string instructorID, string courseID) {
    for (auto& inst : instructors) {
        if (inst.instructorID == instructorID) {
            return find(inst.qualifiedCourses.begin(), inst.qualifiedCourses.end(), courseID) != inst.qualifiedCourses.end();
        }
    }
    for (auto& ta : tas) {
        if (ta.taID == instructorID) {
            return find(ta.qualifiedCourses.begin(), ta.qualifiedCourses.end(), courseID) != ta.qualifiedCourses.end();
        }
    }
    return false;
}

void applyMove(const CSPVariable& var, const CSPValue& val) {
    string type = getCourse[var.courseID].type;

    for (int secIdx : var.targetSectionIndices) {
        sectionScheduledCourses[secIdx].insert(var.courseID);

        Timetable[val.startSlot][secIdx].courseID = var.courseID;
        Timetable[val.startSlot][secIdx].type = type;
        Timetable[val.startSlot][secIdx].roomID = val.roomID;
        Timetable[val.startSlot][secIdx].instructorID = val.instructorID;
        Timetable[val.startSlot][secIdx].duration = var.duration;
        Timetable[val.startSlot][secIdx].istaken = true;
        Timetable[val.startSlot][secIdx].isCont = false;

        for (int i = 1; i < var.duration; i++) {
            Timetable[val.startSlot + i][secIdx].courseID = var.courseID;
            Timetable[val.startSlot + i][secIdx].type = type;
            Timetable[val.startSlot + i][secIdx].roomID = val.roomID;
            Timetable[val.startSlot + i][secIdx].instructorID = val.instructorID;
            Timetable[val.startSlot + i][secIdx].duration = var.duration;
            Timetable[val.startSlot + i][secIdx].istaken = true;
            Timetable[val.startSlot + i][secIdx].isCont = true;
        }
    }

    for (int s = val.startSlot; s < val.startSlot + var.duration; s++) {
        instructorBusy[s].insert(val.instructorID);
        if (val.roomID != "") roomBusy[s].insert(val.roomID);
    }
}

void undoMove(const CSPVariable& var, const CSPValue& val) {
    for (int secIdx : var.targetSectionIndices) {
        sectionScheduledCourses[secIdx].erase(var.courseID);
        for (int s = val.startSlot; s < val.startSlot + var.duration; s++) {
            Timetable[s][secIdx] = Slot();
        }
    }

    for (int s = val.startSlot; s < val.startSlot + var.duration; s++) {
        instructorBusy[s].erase(val.instructorID);
        if (val.roomID != "") roomBusy[s].erase(val.roomID);
    }
}

bool isValidMove(const CSPVariable& var, const CSPValue& val) {
    if (val.startSlot + var.duration > SLOTS_MAX) return false;
    if (var.duration > 1 && val.startSlot % var.duration != 0) return false;

    for (int s = val.startSlot; s < val.startSlot + var.duration; s++) {
        if (!isInstructorAvailable(val.instructorID, s)) return false;
    }

    if (val.roomID != "") {
        for (int s = val.startSlot; s < val.startSlot + var.duration; s++) {
            if (roomBusy[s].count(val.roomID)) return false;
        }
    }

    for (int secIdx : var.targetSectionIndices) {
        for (int s = val.startSlot; s < val.startSlot + var.duration; s++) {
            if (Timetable[s][secIdx].istaken) return false;
        }
    }

    return true;
}

vector<CSPValue> generateDomain(const CSPVariable& var) {
    vector<CSPValue> domain;
    const Course& c = getCourse[var.courseID];

    vector<string> qualifiedInstructors;
    for (auto& inst : instructors) if (isQualified(inst.instructorID, var.courseID)) qualifiedInstructors.push_back(inst.instructorID);
    for (auto& ta : tas) if (isQualified(ta.taID, var.courseID)) qualifiedInstructors.push_back(ta.taID);

    if (qualifiedInstructors.empty()) return domain;

    vector<string> qualifiedRooms;
    if (var.courseID == "GRAD1" || var.courseID == "GRAD2") {
        qualifiedRooms.push_back("");
    }
    else {
        for (auto& room : rooms) {
            if (room.type != c.type) continue;
            if (c.type == "Lab" && !c.labType.empty() && room.labType != c.labType) continue;
            if (!c.allYear && room.capacity < var.totalStudents) continue;
            qualifiedRooms.push_back(room.roomID);
        }
    }

    if (qualifiedRooms.empty()) return domain;

    for (int slot = 0; slot <= SLOTS_MAX - c.duration; slot++) {

        bool sectionsFree = true;
        for (int secIdx : var.targetSectionIndices) {
            for (int s = slot; s < slot + c.duration; s++) {
                if (Timetable[s][secIdx].istaken) { sectionsFree = false; break; }
            }
            if (!sectionsFree) break;
        }
        if (!sectionsFree) continue;

        for (const string& instID : qualifiedInstructors) {
            bool instFree = true;
            for (int s = slot; s < slot + c.duration; s++) {
                if (!isInstructorAvailable(instID, s)) { instFree = false; break; }
            }
            if (!instFree) continue;

            for (const string& roomID : qualifiedRooms) {
                CSPValue val;
                val.startSlot = slot;
                val.instructorID = instID;
                val.roomID = roomID;

                if (isValidMove(var, val)) {
                    domain.push_back(val);
                }
            }
        }
    }

    return domain;
}

vector<CSPVariable> identifyVariables() {
    vector<CSPVariable> variables;
    int varIdCounter = 0;

    unordered_set<string> processedGroupCourses;

    for (int i = 0; i < sections.size(); i++) {
        Section& sec = sections[i];

        for (const string& cID : sec.assignedCourses) {
            if (getCourse.find(cID) == getCourse.end()) continue;
            Course& c = getCourse[cID];

            if (c.type == "Lecture" || c.allYear) {
                string groupKey = sec.groupID + "_" + cID;
                if (processedGroupCourses.find(groupKey) != processedGroupCourses.end()) {
                    continue;
                }

                CSPVariable var;
                var.id = varIdCounter++;
                var.courseID = cID;
                var.isHardConstraint = (cID == "GRAD1" || cID == "GRAD2");
                var.duration = c.duration;

                if (groupToSectionIndices.count(sec.groupID)) {
                    var.targetSectionIndices = groupToSectionIndices[sec.groupID];
                }
                else {
                    var.targetSectionIndices.push_back(i);
                }

                var.totalStudents = 0;
                for (int idx : var.targetSectionIndices) var.totalStudents += sections[idx].studentCount;

                var.availableInstructorsCount = 0;

                variables.push_back(var);
                processedGroupCourses.insert(groupKey);
            }
            else {
                CSPVariable var;
                var.id = varIdCounter++;
                var.courseID = cID;
                var.targetSectionIndices.push_back(i);
                var.totalStudents = sec.studentCount;
                var.duration = c.duration;
                var.isHardConstraint = false;

                variables.push_back(var);
            }
        }
    }

    sort(variables.begin(), variables.end(), [](const CSPVariable& a, const CSPVariable& b) {
        if (a.isHardConstraint != b.isHardConstraint) return a.isHardConstraint > b.isHardConstraint;

        if (a.duration != b.duration) return a.duration > b.duration;

        if (a.totalStudents != b.totalStudents) return a.totalStudents > b.totalStudents;

        return a.targetSectionIndices.size() > b.targetSectionIndices.size();
        });

    return variables;
}

bool solveIterative() {
    vector<CSPVariable> variables = identifyVariables();
    int n = variables.size();

    if (n == 0) return true;

    vector<vector<CSPValue>> domains(n);
    vector<int> domainIndices(n, -1);
    int depth = 0;

    domains[0] = generateDomain(variables[0]);

    while (depth >= 0 && depth < n) {
        auto currentTime = chrono::steady_clock::now();
        if (chrono::duration_cast<chrono::seconds>(currentTime - startTime).count() > 60) {
            lastError = "Timeout limit reached.";
            return false;
        }

        iterationCount++;
        if (iterationCount > MAX_ITERATIONS) {
            lastError = "Max iterations reached.";
            return false;
        }

        bool foundAssignment = false;

        while (true) {
            domainIndices[depth]++;

            if (domainIndices[depth] >= domains[depth].size()) {
                break;
            }

            CSPValue& val = domains[depth][domainIndices[depth]];

            applyMove(variables[depth], val);
            foundAssignment = true;
            break;
        }

        if (foundAssignment) {
            depth++;
            if (depth < n) {
                domains[depth] = generateDomain(variables[depth]);
                domainIndices[depth] = -1;

                if (domains[depth].empty()) {
                    if (depth > 0) {
                    }
                }
            }
        }
        else {
            if (lastError == "") {
                lastError = "Unable to schedule " + getCourse[variables[depth].courseID].courseName +
                    " (Depth " + to_string(depth) + ")";
            }

            domains[depth].clear();

            depth--;

            if (depth >= 0) {
                CSPValue& prevVal = domains[depth][domainIndices[depth]];
                undoMove(variables[depth], prevVal);
            }
        }
    }

    return (depth == n);
}

void clearData() {
    courses.clear();
    instructors.clear();
    tas.clear();
    rooms.clear();
    sections.clear();
    getCourse.clear();
    sectionToIndex.clear();
    groupToSectionIndices.clear();

    Timetable.clear();
    sectionScheduledCourses.clear();

    for (int i = 0; i < SLOTS_MAX; i++) {
        instructorBusy[i].clear();
        roomBusy[i].clear();
    }

    lastError = "";
    iterationCount = 0;
}

void parseInputData(const json& inputData) {
    clearData();

    if (inputData.contains("courses")) {
        for (auto c : inputData["courses"]) {
            Course course;
            course.courseID = c.value("courseID", "");
            course.courseName = c.value("courseName", "");
            string type = c.value("type", "");
            if (type == "lec" || type == "Lec" || type == "lecture") course.type = "Lecture";
            else if (type == "tut" || type == "Tut" || type == "tutorial") course.type = "Tutorial";
            else if (type == "lab" || type == "Lab") course.type = "Lab";
            else course.type = type;

            course.labType = c.value("labType", "");
            course.allYear = c.value("allYear", false);
            course.duration = c.value("duration", 1);
            courses.push_back(course);
            getCourse[course.courseID] = course;
        }
    }

    if (inputData.contains("instructors")) {
        for (auto i : inputData["instructors"]) {
            Instructor instructor;
            instructor.instructorID = i.value("instructorID", "");
            instructor.name = i.value("name", "");
            if (i.contains("qualifiedCourses")) instructor.qualifiedCourses = i["qualifiedCourses"].get<vector<string>>();
            if (i.contains("unavailableTimeSlots")) instructor.unavailableTimeSlots = i["unavailableTimeSlots"].get<vector<int>>();
            instructors.push_back(instructor);
        }
    }

    if (inputData.contains("tas")) {
        for (auto t : inputData["tas"]) {
            TA ta;
            ta.taID = t.value("taID", "");
            ta.name = t.value("name", "");
            if (t.contains("qualifiedCourses")) ta.qualifiedCourses = t["qualifiedCourses"].get<vector<string>>();
            if (t.contains("unavailableTimeSlots")) ta.unavailableTimeSlots = t["unavailableTimeSlots"].get<vector<int>>();
            tas.push_back(ta);
        }
    }

    if (inputData.contains("rooms")) {
        for (auto r : inputData["rooms"]) {
            Room room;
            room.roomID = r.value("roomID", "");
            string type = r.value("type", "");
            if (type == "lec" || type == "lecture") room.type = "Lecture";
            else if (type == "tut" || type == "tutorial") room.type = "Tutorial";
            else if (type == "lab" || type == "Lab") room.type = "Lab";
            else room.type = type;

            room.labType = r.value("labType", "");
            room.capacity = r.value("capacity", 0);
            rooms.push_back(room);
        }
    }

    if (inputData.contains("sections")) {
        int idx = 0;
        for (auto s : inputData["sections"]) {
            Section section;
            section.sectionID = s.value("sectionID", "");
            section.groupID = s.value("groupID", "");
            section.year = s.value("year", 1);
            section.studentCount = s.value("studentCount", 0);
            if (s.contains("assignedCourses")) section.assignedCourses = s["assignedCourses"].get<vector<string>>();
            else if (s.contains("courses")) section.assignedCourses = s["courses"].get<vector<string>>();

            sections.push_back(section);
            sectionToIndex[section.sectionID] = idx;
            groupToSectionIndices[section.groupID].push_back(idx);
            idx++;
        }
    }

    SECTIONS_MAX = sections.size();
    Timetable.resize(SLOTS_MAX, vector<Slot>(SECTIONS_MAX, Slot()));
    sectionScheduledCourses.resize(SECTIONS_MAX);
}

json timetableToJson() {
    json result;
    result["success"] = true;
    result["slotsMax"] = SLOTS_MAX;

    json sectionsSchedule = json::array();

    for (size_t j = 0; j < sections.size(); j++) {
        json sectionData;
        sectionData["sectionID"] = sections[j].sectionID;
        sectionData["groupID"] = sections[j].groupID;

        json schedule = json::array();

        for (int i = 0; i < SLOTS_MAX; i++) {
            if (Timetable[i][j].istaken && !Timetable[i][j].isCont) {
                json slot;
                slot["slotIndex"] = i;
                slot["courseID"] = Timetable[i][j].courseID;
                slot["courseName"] = getCourse[Timetable[i][j].courseID].courseName;
                slot["type"] = Timetable[i][j].type;
                slot["roomID"] = Timetable[i][j].roomID;
                slot["instructorID"] = Timetable[i][j].instructorID;
                slot["instructorName"] = getInstructorName(Timetable[i][j].instructorID);
                slot["duration"] = Timetable[i][j].duration;

                if (Timetable[i][j].duration > 1) {
                    slot["slotRange"] = to_string(i) + "-" + to_string(i + Timetable[i][j].duration - 1);
                }
                else {
                    slot["slotRange"] = to_string(i);
                }
                schedule.push_back(slot);
            }
        }
        sectionData["schedule"] = schedule;
        sectionsSchedule.push_back(sectionData);
    }

    result["sections"] = sectionsSchedule;
    return result;
}

int main() {
    Server svr;

    svr.Post("/api/schedule", [](const Request& req, Response& res) {
        try {
            json inputData = json::parse(req.body);
            parseInputData(inputData);

            startTime = chrono::steady_clock::now();

            cout << "Starting Iterative CSP Solver..." << endl;
            cout << "Variables to schedule: " << sections.size() << " sections (raw)" << endl;

            bool success = solveIterative();

            auto endTime = chrono::steady_clock::now();
            auto duration = chrono::duration_cast<chrono::milliseconds>(endTime - startTime).count();

            json response;
            if (success) {
                response = timetableToJson();
                cout << "SUCCESS: Timetable generated in " << duration << "ms (" << iterationCount << " iterations)" << endl;
            }
            else {
                response["success"] = false;
                response["error"] = lastError.empty() ? "No valid solution found." : lastError;
                response["iterations"] = iterationCount;
                cout << "FAILED: " << lastError << endl;
            }

            response["diagnostics"]["timeTakenMs"] = duration;
            response["diagnostics"]["iterations"] = iterationCount;

            res.set_content(response.dump(2), "application/json");
            res.set_header("Access-Control-Allow-Origin", "*");
            res.status = success ? 200 : 400;

        }
        catch (const exception& e) {
            json errorResponse;
            errorResponse["success"] = false;
            errorResponse["error"] = string("Server error: ") + e.what();
            res.set_content(errorResponse.dump(), "application/json");
            res.status = 500;
        }
        });


    svr.Options("/api/schedule", [](const Request& req, Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
        });

    cout << "CSP Timetable Server running at http://0.0.0.0:8080" << endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}