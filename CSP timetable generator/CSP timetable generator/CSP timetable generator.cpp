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
#include <random> // Added for shuffling

using json = nlohmann::json;
using namespace httplib;
using namespace std;

// --- Data Structures ---

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
    bool isCont; // Is continuation of previous slot

    Slot() : duration(0), istaken(false), isCont(false) {}
};

struct CSPVariable {
    int id;
    string courseID;
    vector<int> targetSectionIndices; // Indices in the global 'sections' vector
    int totalStudents;

    int duration;
    bool isHardConstraint; // e.g., Fixed schedules
};

struct CSPValue {
    int startSlot;
    string instructorID;
    string roomID;
};

// --- Global Data Storage ---

vector<Course> courses;
vector<Instructor> instructors;
vector<TA> tas;
vector<Room> rooms;
vector<Section> sections;

const int SLOTS_MAX = 40;
int SECTIONS_MAX;
vector<vector<Slot>> Timetable;

// Index maps
unordered_map<string, int> sectionToIndex;
unordered_map<string, vector<int>> groupToSectionIndices;
unordered_map<int, vector<int>> yearToSectionIndices; // New: Map Year -> List of Section Indices
unordered_map<string, Course> getCourse;

// Constraint Sets
unordered_set<string> instructorBusy[SLOTS_MAX];
unordered_set<string> roomBusy[SLOTS_MAX];
vector<unordered_set<string>> sectionScheduledCourses;

string lastError = "";
int iterationCount = 0;
const int MAX_ITERATIONS = 2000000; // Reduced slightly to allow for retries
const int MAX_RETRIES = 5;          // Number of times to shuffle and retry
auto startTime = chrono::steady_clock::now();

// --- Helper Functions ---

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

// --- Validation Logic (New) ---

vector<string> validateInput() {
    vector<string> errors;

    // 1. Check if assigned courses exist
    for (const auto& sec : sections) {
        for (const auto& cID : sec.assignedCourses) {
            if (getCourse.find(cID) == getCourse.end()) {
                errors.push_back("Section " + sec.sectionID + " is assigned unknown course: " + cID);
            }
        }
    }

    // 2. Check if every course has at least one qualified instructor
    for (const auto& course : courses) {
        bool hasQualified = false;
        for (const auto& inst : instructors) {
            if (isQualified(inst.instructorID, course.courseID)) {
                hasQualified = true; break;
            }
        }
        if (!hasQualified) {
            for (const auto& ta : tas) {
                if (isQualified(ta.taID, course.courseID)) {
                    hasQualified = true; break;
                }
            }
        }

        if (!hasQualified) {
            errors.push_back("Course " + course.courseName + " (" + course.courseID + ") has no qualified instructors or TAs.");
        }
    }

    return errors;
}

// --- CSP Logic ---

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
    // Constraint: Slots larger than 1 hour should align (heuristic, optional)
    // if (var.duration > 1 && val.startSlot % var.duration != 0) return false; 

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
    // Specific hardcoded constraint for GRAD courses if needed
    if (var.courseID == "GRAD1" || var.courseID == "GRAD2") {
        qualifiedRooms.push_back("");
    }
    else {
        for (auto& room : rooms) {
            if (room.type != c.type) continue;
            if (c.type == "Lab" && !c.labType.empty() && room.labType != c.labType) continue;
            // Capacity Check: Must hold total students of all combined sections
            if (room.capacity < var.totalStudents) continue;
            qualifiedRooms.push_back(room.roomID);
        }
    }

    if (qualifiedRooms.empty() && var.courseID != "GRAD1" && var.courseID != "GRAD2") return domain;

    for (int slot = 0; slot <= SLOTS_MAX - c.duration; slot++) {

        // Check Section Availability first
        bool sectionsFree = true;
        for (int secIdx : var.targetSectionIndices) {
            for (int s = slot; s < slot + c.duration; s++) {
                if (Timetable[s][secIdx].istaken) { sectionsFree = false; break; }
            }
            if (!sectionsFree) break;
        }
        if (!sectionsFree) continue;

        for (const string& instID : qualifiedInstructors) {
            // Optimization: check instructor availability before checking rooms
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

    // Heuristic: Shuffle domain to add randomness during retries could be added here, 
    // but the main shuffle happens at variable ordering.
    return domain;
}

// --- Variable Identification (Modified for allYear logic) ---

vector<CSPVariable> identifyVariables() {
    vector<CSPVariable> variables;
    int varIdCounter = 0;

    unordered_set<string> processedGroupCourses;
    unordered_set<string> processedYearCourses; // Track yearly courses

    for (int i = 0; i < sections.size(); i++) {
        Section& sec = sections[i];

        for (const string& cID : sec.assignedCourses) {
            if (getCourse.find(cID) == getCourse.end()) continue;
            Course& c = getCourse[cID];

            if (c.allYear) {
                // New Logic: Group by Year
                string yearKey = to_string(sec.year) + "_" + cID;
                if (processedYearCourses.count(yearKey)) continue;

                CSPVariable var;
                var.id = varIdCounter++;
                var.courseID = cID;
                var.isHardConstraint = (cID == "GRAD1" || cID == "GRAD2");
                var.duration = c.duration;

                // Get all sections for this year
                if (yearToSectionIndices.count(sec.year)) {
                    var.targetSectionIndices = yearToSectionIndices[sec.year];
                }
                else {
                    var.targetSectionIndices.push_back(i); // Fallback
                }

                var.totalStudents = 0;
                for (int idx : var.targetSectionIndices) var.totalStudents += sections[idx].studentCount;

                variables.push_back(var);
                processedYearCourses.insert(yearKey);
            }
            else if (c.type == "Lecture") {
                // Existing Logic: Group by GroupID
                string groupKey = sec.groupID + "_" + cID;
                if (processedGroupCourses.count(groupKey)) continue;

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

                variables.push_back(var);
                processedGroupCourses.insert(groupKey);
            }
            else {
                // Individual Sections (Labs/Tutorials usually)
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

    return variables;
}

// --- Solver ---

bool solveIterative(vector<CSPVariable>& variables) {
    int n = variables.size();
    if (n == 0) return true;

    vector<vector<CSPValue>> domains(n);
    vector<int> domainIndices(n, -1);
    int depth = 0;

    domains[0] = generateDomain(variables[0]);

    while (depth >= 0 && depth < n) {
        auto currentTime = chrono::steady_clock::now();
        // Global timeout check
        if (chrono::duration_cast<chrono::seconds>(currentTime - startTime).count() > 30) {
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

            // Basic forward check happens inside isValidMove called during Apply? 
            // Here we just assume domain generation filtered basics.
            // But we must check against CURRENT state (which changes during recursion)
            if (isValidMove(variables[depth], val)) {
                applyMove(variables[depth], val);
                foundAssignment = true;
                break;
            }
        }

        if (foundAssignment) {
            depth++;
            if (depth < n) {
                domains[depth] = generateDomain(variables[depth]);
                domainIndices[depth] = -1;

                if (domains[depth].empty()) {
                    // Backtrack immediately if no options for next variable
                }
            }
        }
        else {
            // Save error for diagnostics if we fail at root
            if (depth == 0) {
                lastError = "Unable to schedule " + getCourse[variables[depth].courseID].courseName + " (Root)";
            }
            else if (lastError == "") {
                lastError = "Unable to schedule " + getCourse[variables[depth].courseID].courseName + " at depth " + to_string(depth);
            }

            domains[depth].clear(); // Free memory
            depth--;

            if (depth >= 0) {
                CSPValue& prevVal = domains[depth][domainIndices[depth]];
                undoMove(variables[depth], prevVal);
            }
        }
    }

    return (depth == n);
}

// --- Management Functions ---

void clearGlobalData() {
    courses.clear();
    instructors.clear();
    tas.clear();
    rooms.clear();
    sections.clear();
    getCourse.clear();
    sectionToIndex.clear();
    groupToSectionIndices.clear();
    yearToSectionIndices.clear();

    Timetable.clear();
    sectionScheduledCourses.clear();

    for (int i = 0; i < SLOTS_MAX; i++) {
        instructorBusy[i].clear();
        roomBusy[i].clear();
    }
}

// Resets only the scheduling state, keeps inputs (Courses, Sections, etc.)
void resetSimulationState() {
    Timetable.assign(SLOTS_MAX, vector<Slot>(SECTIONS_MAX, Slot()));
    sectionScheduledCourses.assign(SECTIONS_MAX, unordered_set<string>());

    for (int i = 0; i < SLOTS_MAX; i++) {
        instructorBusy[i].clear();
        roomBusy[i].clear();
    }

    lastError = "";
    iterationCount = 0;
}

void parseInputData(const json& inputData) {
    clearGlobalData();

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
            yearToSectionIndices[section.year].push_back(idx); // Populate Year Map
            idx++;
        }
    }

    SECTIONS_MAX = sections.size();
    // Resize is handled in resetSimulationState, but good to init here
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
        sectionData["year"] = sections[j].year;

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

            // 1. Validate Input
            vector<string> validationErrors = validateInput();
            if (!validationErrors.empty()) {
                json errResponse;
                errResponse["success"] = false;
                errResponse["error"] = "Input validation failed";
                errResponse["details"] = validationErrors;
                res.set_content(errResponse.dump(2), "application/json");
                res.status = 400;
                cout << "Validation Failed: " << validationErrors.size() << " errors found." << endl;
                return;
            }

            startTime = chrono::steady_clock::now();
            resetSimulationState();

            // 2. Identify Variables
            vector<CSPVariable> variables = identifyVariables();

            cout << "Starting CSP Solver..." << endl;
            cout << "Variables to schedule: " << variables.size() << endl;

            // 3. Initial Heuristic Sort (Most Constrained First)
            // Sort priority: Hard Constraints > Longest Duration > Largest Student Count > Most Sections
            sort(variables.begin(), variables.end(), [](const CSPVariable& a, const CSPVariable& b) {
                if (a.isHardConstraint != b.isHardConstraint) return a.isHardConstraint > b.isHardConstraint;
                if (a.duration != b.duration) return a.duration > b.duration;
                if (a.totalStudents != b.totalStudents) return a.totalStudents > b.totalStudents;
                return a.targetSectionIndices.size() > b.targetSectionIndices.size();
                });

            // 4. Attempt to Solve (Initial Attempt)
            bool success = solveIterative(variables);

            // 5. Retry Logic with Random Shuffling if failed
            int attempts = 0;
            std::random_device rd;
            std::mt19937 g(rd());

            while (!success && attempts < MAX_RETRIES) {
                cout << "Solution attempt " << (attempts + 1) << " failed. Shuffling variables and retrying..." << endl;

                resetSimulationState(); // Clear the board

                // Shuffle the order of variables to escape local optima or bad search trees
                // We keep Hard Constraints at the front to ensure critical items get slots, 
                // but shuffle the rest, or shuffle everything if necessary.
                // Here we perform a full shuffle for maximum variation as requested.
                std::shuffle(variables.begin(), variables.end(), g);

                startTime = chrono::steady_clock::now(); // Reset timer for the new attempt
                success = solveIterative(variables);
                attempts++;
            }

            auto endTime = chrono::steady_clock::now();
            auto duration = chrono::duration_cast<chrono::milliseconds>(endTime - startTime).count();

            json response;
            if (success) {
                response = timetableToJson();
                cout << "SUCCESS: Timetable generated in " << duration << "ms (Attempts: " << attempts + 1 << ")" << endl;
            }
            else {
                response["success"] = false;
                response["error"] = lastError.empty() ? "No valid solution found after multiple attempts." : lastError;
                response["iterations"] = iterationCount;
                response["attempts"] = attempts + 1;
                cout << "FAILED: " << lastError << endl;
            }

            response["diagnostics"]["timeTakenMs"] = duration;
            response["diagnostics"]["totalAttempts"] = attempts + 1;

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
    if (!svr.listen("0.0.0.0", 8080)) {
        cerr << "Error: Could not start server on port 8080." << endl;
        return 1;
    }

    return 0;
}