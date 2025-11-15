import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { studentAPI, departmentAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { Users, Upload, AlertCircle, FileText, Building, Filter, Trash2, UserPlus, Search, CheckSquare, Square } from 'lucide-react';
import StudentUploadModal from './StudentUploadModal.jsx';
import AddStudentForm from './AddStudentForm.jsx';
import BulkStudentOperations from './BulkStudentOperations.jsx';

const StudentManagement = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchDepartments();
  }, [selectedDepartment, searchTerm]);

  useEffect(() => {
    // Check if upload parameter is in URL
    const urlParams = new URLSearchParams(location.search);
    const uploadParam = urlParams.get('upload');
    const addParam = urlParams.get('add');
    const deptParam = urlParams.get('dept');
    
    if (uploadParam === 'true') {
      setShowUploadModal(true);
      // Clean up the URL parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('upload');
      window.history.replaceState({}, '', newUrl);
    }
    
    if (addParam === 'true') {
      setShowAddForm(true);
      // Clean up the URL parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('add');
      window.history.replaceState({}, '', newUrl);
    }
    
    // Set department filter if dept parameter is present
    if (deptParam) {
      setSelectedDepartment(deptParam);
      // Clean up the URL parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('dept');
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search]);

  // Use students directly since filtering is now handled by backend
  const filteredStudents = students;

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getByCollege(user?.id);
      setDepartments(response?.data?.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (selectedDepartment) params.department = selectedDepartment;
      if (searchTerm) params.search = searchTerm;
      
      const response = await studentAPI.getAll(params);
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentsUploaded = () => {
    fetchStudents(); // Refresh the list
    fetchDepartments(); // Refresh departments to update counts
  };

  const handleStudentAdded = () => {
    fetchStudents(); // Refresh the list
    fetchDepartments(); // Refresh departments to update counts
  };

  const handleBulkOperationComplete = () => {
    fetchStudents(); // Refresh the list
    fetchDepartments(); // Refresh departments to update counts
  };

  const handleSelectStudent = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents([]);
      setSelectAll(false);
    } else {
      setSelectedStudents(filteredStudents.map(student => student._id));
      setSelectAll(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedStudents([]);
    setSelectAll(false);
  };

  const handleDeleteStudent = async (studentId) => {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return;
    }

    try {
      await studentAPI.delete(studentId);
      toast.success('🎉 Student deleted successfully!');
      fetchStudents(); // Refresh the list
      fetchDepartments(); // Refresh departments to update counts
      // Refresh overview if available
      if (window.refreshOverview) {
        window.refreshOverview();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete student';
      toast.error(`❌ ${message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Student Management</h1>
          <p className="opacity-70 mt-1">
            Manage student records and registrations
          </p>
        </div>
        
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-base-300 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-4 bg-base-300 rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-4 bg-base-300 rounded w-3/4 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Management</h1>
          <p className="opacity-70 mt-1">
            Manage student records and registrations
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn btn-ghost flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload CSV</span>
          </button>
        </div>
      </div>
      
      {filteredStudents.length === 0 ? (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-12 text-center">
          <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 opacity-70" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Students Yet</h3>
          <p className="opacity-70 mb-6 max-w-md mx-auto">
            You haven't uploaded any student records yet. Upload student data to start managing your college's student body.
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => setShowAddForm(true)}
              className="btn-primary flex items-center space-x-2 mx-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New Student</span>
            </button>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="btn btn-ghost flex items-center space-x-2 mx-auto"
            >
              <Upload className="w-4 h-4" />
              <span>Upload CSV</span>
            </button>
            <div className="text-sm opacity-70">
              <p>Supported formats: CSV</p>
              <p>Required fields: USN, Name, Email</p>
              <p>Supports same department or mixed departments</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Student Records</h3>
              <p className="text-sm opacity-70 mt-1">Total: {filteredStudents.length} students</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Search Bar */}
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 opacity-60" />
                <input
                  type="text"
                  placeholder="Search by name, USN, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input input-bordered input-sm text-sm"
                />
              </div>
              
              {/* Department Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 opacity-60" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="select select-bordered select-sm text-sm"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.totalStudents || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-base-200">
                  <th className="text-left py-3 px-4 font-medium">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center space-x-2 link link-hover"
                    >
                      {selectAll ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>Select All</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium">USN</th>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Department</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => (
                  <tr key={index} className="border-b border-base-200 hover:bg-base-200/50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleSelectStudent(student._id)}
                        className="flex items-center space-x-2 link link-hover"
                      >
                        {selectedStudents.includes(student._id) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm">{student.usn}</td>
                    <td className="py-3 px-4 text-sm">{student.name}</td>
                    <td className="py-3 px-4 text-sm opacity-80">{student.email}</td>
                    <td className="py-3 px-4 text-sm opacity-80">
                      {student.department?.name || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button 
                        onClick={() => handleDeleteStudent(student._id)}
                        className="btn btn-ghost btn-xs p-1 text-red-500"
                        title="Delete Student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Student Upload Modal */}
      <StudentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleStudentsUploaded}
      />

      {/* Add Student Form */}
      <AddStudentForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSuccess={handleStudentAdded}
        preSelectedDepartment={selectedDepartment}
      />

      {/* Bulk Student Operations */}
      <BulkStudentOperations
        selectedStudents={selectedStudents}
        onClearSelection={handleClearSelection}
        onOperationComplete={handleBulkOperationComplete}
        departments={departments}
      />
    </div>
  );
};

export default StudentManagement; 