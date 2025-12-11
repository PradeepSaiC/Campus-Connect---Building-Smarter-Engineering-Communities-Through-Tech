import { useState, useEffect } from 'react';
import { collegeAPI, departmentAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { 
  Building, 
  Users, 
  ChevronDown, 
  ChevronRight,
  MapPin,
  GraduationCap,
  ExternalLink
} from 'lucide-react';
import StudentProfileModal from './StudentProfileModal.jsx';

const CollegesList = () => {
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentStudents, setDepartmentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedColleges, setExpandedColleges] = useState(new Set());
  const [loadedDepartments, setLoadedDepartments] = useState({}); // collegeId -> departments
  const [showProfile, setShowProfile] = useState(false);
  const [selectedStudentData, setSelectedStudentData] = useState(null);

  useEffect(() => {
    const mountedRef = { current: true };
    const load = async () => {
      await fetchColleges(mountedRef);
    };
    load();
    return () => { mountedRef.current = false; };
  }, []);

  const fetchColleges = async (mountedRef) => {
    try {
      if (!mountedRef || mountedRef.current) setLoading(true);
      const response = await collegeAPI.getAll();
      if (!mountedRef || mountedRef.current) setColleges(response.data || []);
    } catch (error) {
      console.error('Error fetching colleges:', error);
      if (!(error?.response?.status === 401)) {
        if (!mountedRef || mountedRef.current) toast.error('❌ Failed to load colleges');
      }
    } finally {
      if (!mountedRef || mountedRef.current) setLoading(false);
    }
  };

  const toggleCollege = async (collegeId) => {
    const newExpanded = new Set(expandedColleges);
    if (newExpanded.has(collegeId)) {
      newExpanded.delete(collegeId);
      setSelectedCollege(null);
      setSelectedDepartment(null);
      setDepartmentStudents([]);
    } else {
      newExpanded.add(collegeId);
      // Fetch departments for this college when expanding
      try {
        const resp = await departmentAPI.getByCollege(collegeId);
        const depts = resp.data?.departments || [];
        setLoadedDepartments((prev) => ({ ...prev, [collegeId]: depts }));
      } catch (e) {
        console.error('Error loading departments:', e);
        toast.error('❌ Failed to load departments');
      }
    }
    setExpandedColleges(newExpanded);
  };

  const handleDepartmentClick = async (departmentId) => {
    try {
      setSelectedDepartment(departmentId);
      const response = await departmentAPI.getStudents(departmentId);
      const students = Array.isArray(response.data)
        ? response.data
        : (response.data?.students || []);
      setDepartmentStudents(students);
    } catch (error) {
      console.error('Error fetching department students:', error);
      toast.error('❌ Failed to load students');
    }
  };

  const handleStudentClick = (student) => {
    setSelectedStudentData(student);
    setShowProfile(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2 opacity-70">Loading colleges...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Colleges</h1>
          <p className="opacity-70 mt-1">
            Explore colleges and connect with students across institutions
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600">{colleges.length}</p>
          <p className="text-sm opacity-70">Total Colleges</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colleges List */}
        <div className="lg:col-span-1">
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200">
            <div className="p-6 border-b border-base-200">
              <h2 className="text-lg font-semibold">All Colleges</h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {colleges.length === 0 ? (
                <div className="p-6 text-center opacity-70">
                  <p>No colleges found</p>
                </div>
              ) : (
                colleges.map((college) => (
                  <div key={college._id} className="border-b border-base-200 last:border-b-0">
                    <button
                      onClick={() => toggleCollege(college._id)}
                      className="w-full p-4 text-left hover:bg-base-200 transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            role="button"
                            tabIndex={0}
                            title="View college details"
                            onClick={(e) => {
                              e.stopPropagation();
                              try { window.dispatchEvent(new CustomEvent('open_college_details', { detail: { collegeId: String(college._id) } })); } catch (_) {}
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                try { window.dispatchEvent(new CustomEvent('open_college_details', { detail: { collegeId: String(college._id) } })); } catch (_) {}
                              }
                            }}
                            className="w-10 h-10 bg-base-300 rounded-lg flex items-center justify-center hover:bg-base-200 transition-colors overflow-hidden"
                          >
                            {college?.collegeLogo ? (
                              <img src={college.collegeLogo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              <Building className="w-5 h-5 text-primary-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{String(college?.collegeName ?? '')}</h3>
                            <p className="text-sm opacity-70">{String(college?.collegeType ?? '')}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm opacity-70">
                            { (loadedDepartments[college._id]?.length ?? college.departments?.length ?? 0) } departments
                          </span>
                          {expandedColleges.has(college._id) ? (
                            <ChevronDown className="w-4 h-4 opacity-60" />
                          ) : (
                            <ChevronRight className="w-4 h-4 opacity-60" />
                          )}
                        </div>
                      </div>
                    </button>

                    {expandedColleges.has(college._id) && (
                      <div className="bg-base-200 border-t border-base-200">
                        <div className="p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <MapPin className="w-4 h-4 opacity-60" />
                            <span className="text-sm opacity-70">{String(college?.collegeAddress ?? '')}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Departments</h4>
                            {(loadedDepartments[college._id] || college.departments || []).map((dept) => (
                              <button
                                key={dept._id}
                                onClick={() => handleDepartmentClick(dept._id)}
                                className={`w-full text-left p-2 rounded-lg transition-colors duration-200 ${
                                  selectedDepartment === dept._id
                                    ? 'bg-base-300'
                                    : 'hover:bg-base-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{String(dept?.name ?? '')}</span>
                                  <span className="text-xs opacity-70">
                                    {dept.totalStudents || 0} students
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="lg:col-span-2">
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200">
            <div className="p-6 border-b border-base-200">
              <h2 className="text-lg font-semibold">
                {selectedDepartment ? 'Department Students' : 'Select a Department'}
              </h2>
              {selectedDepartment && (
                <p className="text-sm opacity-70 mt-1">
                  {departmentStudents.length} students found
                </p>
              )}
            </div>
            
            <div className="p-6">
              {!selectedDepartment ? (
                <div className="text-center opacity-70 py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p>Select a department to view students</p>
                </div>
              ) : departmentStudents.length === 0 ? (
                <div className="text-center opacity-70 py-12">
                  <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p>No students found in this department</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departmentStudents.map((student) => (
                    <div
                      key={student._id}
                      className="bg-base-200 rounded-lg p-4 hover:bg-base-300 transition-colors duration-200 cursor-pointer"
                      onClick={() => handleStudentClick(student)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center overflow-hidden">
                          {student?.photoURL ? (
                            <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-semibold">{(student?.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">
                            {student.name}
                          </h3>
                          <p className="text-sm opacity-70 truncate">
                            {student.usn}
                          </p>
                          <p className="text-xs opacity-60 truncate">
                            {student.college?.collegeName}
                          </p>
                        </div>
                      </div>
                      
                      {student.interests && student.interests.length > 0 && (
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-1">
                            {student.interests.slice(0, 2).map((interest, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-base-300 text-base-content/80 text-xs rounded-full"
                              >
                                {interest}
                              </span>
                            ))}
                            {student.interests.length > 2 && (
                              <span className="px-2 py-1 bg-base-300 text-base-content/70 text-xs rounded-full">
                                +{student.interests.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <StudentProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        student={selectedStudentData}
      />
    </div>
  );
};

export default CollegesList; 