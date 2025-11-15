import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { departmentAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { Plus, Building, AlertCircle, Trash2, Edit, UserPlus } from 'lucide-react';
import CreateDepartmentModal from './CreateDepartmentModal.jsx';
import EditDepartmentModal from './EditDepartmentModal.jsx';

const DepartmentManagement = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    // Check if create parameter is in URL
    const urlParams = new URLSearchParams(location.search);
    const createParam = urlParams.get('create');
    if (createParam === 'true') {
      setShowCreateModal(true);
      // Clean up the URL parameter
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('create');
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search]);

  const fetchDepartments = async () => {
    setIsLoading(true);
    try {
      const response = await departmentAPI.getByCollege(user?.id);
      setDepartments(response?.data?.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDepartmentCreated = () => {
    fetchDepartments(); // Refresh the list
  };

  const handleDepartmentUpdated = () => {
    fetchDepartments(); // Refresh the list
  };

  const handleEditDepartment = (department) => {
    setSelectedDepartment(department);
    setShowEditModal(true);
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      return;
    }

    try {
      await departmentAPI.delete(departmentId);
      toast.success('🎉 Department deleted successfully!');
      fetchDepartments(); // Refresh the list
      // Refresh overview if available
      if (window.refreshOverview) {
        window.refreshOverview();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete department';
      toast.error(`❌ ${message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Department Management</h1>
          <p className="opacity-70 mt-1">
            Manage departments and academic programs
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
          <h1 className="text-3xl font-bold">Department Management</h1>
          <p className="opacity-70 mt-1">
            Manage departments and academic programs
          </p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>
      
      {departments.length === 0 ? (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-12 text-center">
          <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 opacity-70" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Departments Yet</h3>
          <p className="opacity-70 mb-6 max-w-md mx-auto">
            You haven't created any departments yet. Departments help organize your college's academic programs and students.
          </p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Department</span>
          </button>
        </div>
      ) : (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Your Departments</h3>
            <span className="text-sm opacity-70">Total: {departments.length} departments</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept, index) => (
              <div key={index} className="border border-base-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 bg-base-100">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-base-300 rounded-lg flex items-center justify-center">
                    <Building className="w-4 h-4 opacity-70" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{dept.name}</h4>
                  </div>
                </div>
                <p className="text-sm opacity-80 mb-2">{dept.description || 'No description'}</p>
                <div className="flex items-center justify-between text-xs opacity-70">
                  <span>Students: {dept.totalStudents || 0}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button onClick={() => navigate(`/dashboard?tab=students&dept=${dept._id}`)} className="link link-hover text-xs">View Students →</button>
                    <button onClick={() => navigate(`/dashboard?tab=students&add=true&dept=${dept._id}`)} className="link link-hover text-xs flex items-center space-x-1">
                      <UserPlus className="w-3 h-3" />
                      <span>Add Students</span>
                    </button>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => handleEditDepartment(dept)} className="btn btn-ghost btn-xs p-1" title="Edit Department">
                      <Edit className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDepartment(dept._id)}
                      className="btn btn-ghost btn-xs p-1 text-red-500"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Department Modal */}
      <CreateDepartmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleDepartmentCreated}
      />

      {/* Edit Department Modal */}
      <EditDepartmentModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleDepartmentUpdated}
        department={selectedDepartment}
      />
    </div>
  );
};

export default DepartmentManagement; 