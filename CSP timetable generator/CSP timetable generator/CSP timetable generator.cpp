#include "httplib.h"
#include <nlohmann/json.hpp>
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <iomanip>
#include <sstream>

using json = nlohmann::json;
using namespace httplib;
using namespace std;

#define all(x) (x).begin(),(x).end()

struct Course {
    string courseID, courseName, type;
    string labType;
    int duration;
    bool allYear;
};

struct Instructor {
    string instructorID, name;
    vector<string> qualifiedCourses;
};

struct TA {
    string taID, name;
    vector<string> qualifiedCourses;
};

struct Room {
    string roomID, type;
    string labType;
    int capacity;
};

struct Group {
    string groupID;
    int year;
    vector<string> sections;
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

vector<Course> courses;
vector<Instructor> instructors;
vector<TA> tas;
vector<Room> rooms;
vector<Section> sections;
vector<Group> groups;

const int SLOTS_MAX = 40;
int SECTIONS_MAX;
vector<vector<Slot>> Timetable;

unordered_map<string, int> sectionToIndex;
unordered_set<string> instructorBusy[SLOTS_MAX];
unordered_set<string> roomBusy[SLOTS_MAX];

unordered_map<string, string> sectionToGroup;
unordered_map<string, vector<string>> groupToSections;
unordered_map<int, vector<string>> yearToSections;

vector<unordered_set<string>> scheduledCourses;
unordered_map<string, Course> getCourse;

bool isQualified(string instructorID, string courseID, bool isTA) {
    if (isTA) {
        for (auto& ta : tas) {
            if (ta.taID == instructorID) {
                return find(all(ta.qualifiedCourses), courseID) != ta.qualifiedCourses.end();
            }
        }
    }
    else {
        for (auto& inst : instructors) {
            if (inst.instructorID == instructorID) {
                return find(all(inst.qualifiedCourses), courseID) != inst.qualifiedCourses.end();
            }
        }
    }
    return false;
}

int getTotalStudents(vector<int>& sectionIndices) {
    int total = 0;
    for (int idx : sectionIndices) {
        total += sections[idx].studentCount;
    }
    return total;
}

string getInstructorName(string instructorID) {
    for (auto inst : instructors) {
        if (inst.instructorID == instructorID) {
            return inst.name;
        }
    }

    for (auto ta : tas) {
        if (ta.taID == instructorID) {
            return ta.name;
        }
    }

    return "";
}

bool valid(vector<int>& targetSections, int slot, int duration, string instructorID, string roomID, string courseID) {
    //cout << "duration" << endl;
    if (duration > 1 && slot % duration != 0) return false;
    //cout << "slot" << endl;
    if (slot < 0 || slot >= SLOTS_MAX) return false;
    //cout << "slot+duration" << endl;
    if (slot + duration > SLOTS_MAX) return false;

    //cout << "TargetSections" << endl;
    for (int sec : targetSections) {
        if (sec < 0 || sec >= SECTIONS_MAX) return false;

        for (int s = slot; s < slot + duration; s++) {
            if (Timetable[s][sec].istaken) return false;
        }
    }

    //cout << "instructor" << endl;
    for (int s = slot; s < slot + duration; s++) {
        if (instructorBusy[s].find(instructorID) != instructorBusy[s].end()) return false;
    }

    //cout << "room" << endl;
    if (courseID != "GRAD1" && courseID != "GRAD2")
        for (int s = slot; s < slot + duration; s++) {
            if (roomBusy[s].find(roomID) != roomBusy[s].end()) return false;
        }

    //cout << "true" << endl;
    return true;
}

void place(vector<int>& targetSections, string courseID, string type, int duration, string instructorID, string roomID, int slot) {

    for (int sec : targetSections) {
        Timetable[slot][sec].courseID = courseID;
        Timetable[slot][sec].type = type;
        Timetable[slot][sec].roomID = roomID;
        Timetable[slot][sec].instructorID = instructorID;
        Timetable[slot][sec].duration = duration;
        Timetable[slot][sec].istaken = true;
        Timetable[slot][sec].isCont = false;

        for (int i = 1; i < duration; i++) {
            Timetable[slot + i][sec].courseID = courseID;
            Timetable[slot + i][sec].type = type;
            Timetable[slot + i][sec].roomID = roomID;
            Timetable[slot + i][sec].instructorID = instructorID;
            Timetable[slot + i][sec].duration = duration;
            Timetable[slot + i][sec].istaken = true;
            Timetable[slot + i][sec].isCont = true;
        }

        scheduledCourses[sec].insert(courseID);
    }

    for (int s = slot; s < slot + duration; s++) {
        instructorBusy[s].insert(instructorID);
        if (courseID != "GRAD1" && courseID != "GRAD2")
            roomBusy[s].insert(roomID);
    }
}

void remove(vector<int>& targetSections, string courseID, string instructorID, string roomID, int slot, int duration) {
    for (int sec : targetSections) {
        for (int s = slot; s < slot + duration; s++) {
            Timetable[s][sec] = Slot();
        }

        scheduledCourses[sec].erase(courseID);
    }

    for (int s = slot; s < slot + duration; s++) {
        instructorBusy[s].erase(instructorID);
        if (courseID != "GRAD1" && courseID != "GRAD2")
            roomBusy[s].erase(roomID);
    }
}

bool solve(int sectionIdx) {
    if (sectionIdx >= sections.size()) {
        return true;
    }

    //cout << "startsolve" << endl;
    vector<string>& coursesToSchedule = sections[sectionIdx].assignedCourses;
    bool allScheduled = true;
    for (auto courseID : coursesToSchedule) {
        if (scheduledCourses[sectionIdx].find(courseID) == scheduledCourses[sectionIdx].end()) {
            allScheduled = false;
            break;
        }
    }

    if (allScheduled) {
        return solve(sectionIdx + 1);
    }

    

    string courseID = "";
    for (auto cid : coursesToSchedule) {
        if (scheduledCourses[sectionIdx].find(cid) == scheduledCourses[sectionIdx].end()) {
            courseID = cid;
            break;
        }
    }
    if (getCourse.find(courseID) == getCourse.end()) {
        //cout <<"didn't find " << courseID << endl;
        return false;
    }

    Course course = getCourse[courseID];
    vector<int> targetSections;
    //cout << course.courseName << endl;
   

    vector<string> candidateSections;
    string groupID = sections[sectionIdx].groupID;
    int currentYear = sections[sectionIdx].year;

    if (course.allYear) {
        if (yearToSections.find(currentYear) != yearToSections.end()) {
            candidateSections = yearToSections[currentYear];
        }
    }
    else if (course.type == "Lecture") {
        if (groupToSections.find(groupID) != groupToSections.end()) {
            candidateSections = groupToSections[groupID];
        }
    }
    else {
        targetSections.push_back(sectionIdx);
    }

    

    if (course.allYear || course.type == "Lecture") {

        bool currentSectionNeedsCourse = find(all(sections[sectionIdx].assignedCourses), courseID)
            != sections[sectionIdx].assignedCourses.end();
        
        if (!currentSectionNeedsCourse) {
            scheduledCourses[sectionIdx].insert(courseID);
            return solve(sectionIdx);
        }

        bool allScheduled = true;
        for (auto& secID : candidateSections) {
            auto it = sectionToIndex.find(secID);
            if (it == sectionToIndex.end()) continue;

            int idx = it->second;

            bool sectionNeedsCourse = find(all(sections[idx].assignedCourses), courseID)
                != sections[idx].assignedCourses.end();

            if (sectionNeedsCourse) {
                if (scheduledCourses[idx].find(courseID) == scheduledCourses[idx].end()) {
                    allScheduled = false;
                    break;
                }
            }
        }
       
      
        if (allScheduled) {
            scheduledCourses[sectionIdx].insert(courseID);
            return solve(sectionIdx);
        }

        for (auto& secID : candidateSections) {
            auto it = sectionToIndex.find(secID);
            if (it == sectionToIndex.end()) continue;

            int idx = it->second;

            if (find(all(sections[idx].assignedCourses), courseID) != sections[idx].assignedCourses.end() &&
                scheduledCourses[idx].find(courseID) == scheduledCourses[idx].end()) {
                targetSections.push_back(idx);
            }
        }

        if (targetSections.empty()) {
            scheduledCourses[sectionIdx].insert(courseID);
            return solve(sectionIdx);
        }
    }
   
    int totalStudents = getTotalStudents(targetSections);
    //cout << "target" << endl;
    vector<string> candidates;
    for (auto inst : instructors) {
        if (isQualified(inst.instructorID, courseID, false)) {
            candidates.push_back(inst.instructorID);
        }
    }
    
    for (auto ta : tas) {
        if (isQualified(ta.taID, courseID, true)) {
            candidates.push_back(ta.taID);
        }
    }
    

    if (candidates.empty()) {
        //cout << course.courseName << " NO TA" << endl;
        return false;
    }
    //cout << "cand" << endl;

    bool flag = true;
    

    for (int slot = 0; slot < SLOTS_MAX; slot++) {
        for (auto instructorID : candidates) {
            if (courseID == "GRAD1" || courseID == "GRAD2") {
                //cout << "GRAD1" << " " << targetSections[0]<<" "<<slot << endl;
                if (!valid(targetSections, slot, course.duration, instructorID, "", courseID)) {
                    continue;
                }
                flag = false;
                place(targetSections, courseID, course.type, course.duration, instructorID, "", slot);

                if (solve(sectionIdx)) {
                    return true;
                }

                remove(targetSections, courseID, instructorID, "", slot, course.duration);
            }
            else {
                for (auto room : rooms) {
                    if (room.type != course.type) continue;

                    if (course.type == "Lab" && !course.labType.empty()) {
                        if (room.labType != course.labType) {
                            continue;
                        }
                    }

                    if (!course.allYear && room.capacity < totalStudents) continue;

                    if (!valid(targetSections, slot, course.duration, instructorID, room.roomID, courseID)) {
                        continue;
                    }

                    flag = false;
                    place(targetSections, courseID, course.type, course.duration, instructorID, room.roomID, slot);

                    if (solve(sectionIdx)) {
                        return true;
                    }

                    remove(targetSections, courseID, instructorID, room.roomID, slot, course.duration);
                }
            }
        }
    }
    

    if (flag) {
        //cout << course.courseName << " NO ROOM" << endl;
        return false;
    }
    //cout << "Room" << endl;

    return false;
}

void clearData() {
    courses.clear();
    instructors.clear();
    tas.clear();
    rooms.clear();
    sections.clear();
    groups.clear();
    getCourse.clear();
    sectionToIndex.clear();
    sectionToGroup.clear();
    groupToSections.clear();
    yearToSections.clear();
    scheduledCourses.clear();
    Timetable.clear();

    for (int i = 0; i < SLOTS_MAX; i++) {
        instructorBusy[i].clear();
        roomBusy[i].clear();
    }
}

void parseInputData(const json& inputData) {
    clearData();

    if (inputData.contains("courses")) {
        for (auto c : inputData["courses"]) {
            Course course;
            course.courseID = c.value("courseID", "");
            course.courseName = c.value("courseName", "");

            string type = c.value("type", "");
            if (type == "lec" || type == "Lec" || type == "lecture" || type == "Lecture") {
                course.type = "Lecture";
            }
            else if (type == "tut" || type == "Tut" || type == "tutorial" || type == "Tutorial") {
                course.type = "Tutorial";
            }
            else if (type == "lab" || type == "Lab") {
                course.type = "Lab";
            }
            else {
                course.type = type;
            }

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
            if (i.contains("qualifiedCourses") && i["qualifiedCourses"].is_array()) {
                instructor.qualifiedCourses = i["qualifiedCourses"].get<vector<string>>();
            }
            instructors.push_back(instructor);
        }
    }

    if (inputData.contains("tas")) {
        for (auto t : inputData["tas"]) {
            TA ta;
            ta.taID = t.value("taID", "");
            ta.name = t.value("name", "");
            if (t.contains("qualifiedCourses") && t["qualifiedCourses"].is_array()) {
                ta.qualifiedCourses = t["qualifiedCourses"].get<vector<string>>();
            }
            tas.push_back(ta);
        }
    }

    if (inputData.contains("rooms")) {
        for (auto r : inputData["rooms"]) {
            Room room;
            room.roomID = r.value("roomID", "");

            string type = r.value("type", "");
            if (type == "lec" || type == "lecture" || type == "Lecture") {
                room.type = "Lecture";
            }
            else if (type == "tut" || type == "tutorial" || type == "Tutorial") {
                room.type = "Tutorial";
            }
            else if (type == "lab" || type == "Lab") {
                room.type = "Lab";
            }
            else {
                room.type = type;
            }

            room.labType = r.value("labType", "");

            room.capacity = r.value("capacity", 0);
            rooms.push_back(room);

        }
    }

    if (inputData.contains("groups")) {
        for (auto g : inputData["groups"]) {
            Group group;
            group.groupID = g.value("groupID", "");
            group.year = g.value("year", 1);
            if (g.contains("sections") && g["sections"].is_array()) {
                group.sections = g["sections"].get<vector<string>>();
            }
            groups.push_back(group);

            for (auto sec : group.sections) {
                sectionToGroup[sec] = group.groupID;
                groupToSections[group.groupID].push_back(sec);
            }
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

            if (s.contains("assignedCourses") && s["assignedCourses"].is_array()) {
                section.assignedCourses = s["assignedCourses"].get<vector<string>>();
            }
            else if (s.contains("courses") && s["courses"].is_array()) {
                section.assignedCourses = s["courses"].get<vector<string>>();
            }

            sections.push_back(section);

            sectionToIndex[section.sectionID] = idx;

            yearToSections[section.year].push_back(section.sectionID);

            idx++;
        }
    }

    SECTIONS_MAX = sections.size();
    Timetable.resize(SLOTS_MAX, vector<Slot>(SECTIONS_MAX, Slot()));
    scheduledCourses.resize(SECTIONS_MAX, unordered_set<string>());
}

json timetableToJson() {
    json result;
    result["success"] = true;
    result["slotsMax"] = SLOTS_MAX;
    result["sectionsMax"] = SECTIONS_MAX;

    json sectionsSchedule = json::array();

    for (size_t j = 0; j < sections.size(); j++) {
        json sectionData;
        sectionData["sectionID"] = sections[j].sectionID;
        sectionData["groupID"] = sections[j].groupID;
        sectionData["year"] = sections[j].year;
        sectionData["studentCount"] = sections[j].studentCount;

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

                if (Timetable[i][j].duration == 2) {
                    slot["slotRange"] = to_string(i) + "-" + to_string(i + 1);
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
        json inputData = json::parse(req.body);

        parseInputData(inputData);

        bool success = solve(0);

        json response;
        if (success) {

            response = timetableToJson();
        }
        else {
            response["success"] = false;
            response["error"] = "No valid solution found";
        }

        res.set_content(response.dump(2), "application/json");
        res.set_header("Access-Control-Allow-Origin", "*");
        res.status = success ? 200 : 400;
        });

    svr.Options("/api/schedule", [](const Request& req, Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
        });

    cout << "Timetable Scheduling API Server" << endl;
    cout << "Server running on: http://localhost:8080" << endl;

    svr.listen("0.0.0.0", 8080);

    return 0;
}