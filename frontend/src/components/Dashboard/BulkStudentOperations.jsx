import { useState } from 'react';
import { Users, Trash2, Move, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const BulkStudentOperations = ({ 
  selectedStudents, 
  onClearSelection, 
  onOperationComplete,
  departments 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetDepartment, setTargetDepartment] = useState('');

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedStudents.length} students? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const deletePromises = selectedStudents.map(studentId =>
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/college/students/${studentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth')).state.token}`
          }
        })
      );

      await Promise.all(deletePromises);
      
      toast.success(`🎉 Successfully deleted ${selectedStudents.length} students!`);
      onOperationComplete();
      onClearSelection();
    } catch (error) {
      console.error('Error deleting students:', error);
      toast.error('❌ Failed to delete some students');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkTransfer = async () => {
    if (!targetDepartment) {
      toast.error('❌ Please select a target department');
      return;
    }

    setIsLoading(true);
    try {
      const transferPromises = selectedStudents.map(studentId =>
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/college/students/${studentId}/transfer`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('campusconnect-auth')).state.token}`
          },
          body: JSON.stringify({ departmentId: targetDepartment })
        })
      );

      await Promise.all(transferPromises);
      
      toast.success(`🎉 Successfully transferred ${selectedStudents.length} students!`);
      onOperationComplete();
      onClearSelection();
      setShowTransferModal(false);
      setTargetDepartment('');
    } catch (error) {
      console.error('Error transferring students:', error);
      toast.error('❌ Failed to transfer some students');
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedStudents.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowTransferModal(true)}
                disabled={isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                <Move className="w-4 h-4" />
                <span className="text-sm">Transfer</span>
              </button>
              
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Delete</span>
              </button>
              
              <button
                onClick={onClearSelection}
                disabled={isLoading}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Move className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Transfer Students</h2>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Transfer {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} to a different department.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Department
                </label>
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkTransfer}
                  disabled={isLoading || !targetDepartment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <Move className="w-4 h-4 mr-2" />
                  )}
                  Transfer Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Confirm Deletion</h2>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Are you sure you want to delete {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''}? 
                This action cannot be undone.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Warning</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  This will permanently remove all selected students from the system.
                </p>
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkStudentOperations; 