import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Users, CheckCircle, AlertCircle, Download, Building, Info } from 'lucide-react';
import { collegeAPI, departmentAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';

const StudentUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [uploadType, setUploadType] = useState('same_department');
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Re-parse CSV when upload type changes
  useEffect(() => {
    if (selectedFile) {
      parseCSV(selectedFile);
    }
  }, [uploadType]);

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getByCollege(user?.id);
      setDepartments(response?.data?.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('❌ Please select a CSV file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('❌ File size should be less than 5MB');
      return;
    }

    setSelectedFile(file);
    parseCSV(file);
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Validate required headers based on upload type
        const requiredHeaders = ['usn', 'name', 'email'];
        if (uploadType === 'different_departments') {
          requiredHeaders.push('department');
        }
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          toast.error(`❌ Missing required columns: ${missingHeaders.join(', ')}`);
          setSelectedFile(null);
          return;
        }

        const data = [];
        for (let i = 1; i < Math.min(lines.length, 6); i++) { // Preview first 5 rows
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            data.push(row);
          }
        }

        setPreviewData(data);
        toast.success('✅ CSV file parsed successfully!');
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('❌ Error parsing CSV file');
        setSelectedFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      if (uploadType === 'same_department' && !selectedDepartment) {
        toast.error('❌ Please select a department');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('uploadType', uploadType);
      
      if (uploadType === 'same_department') {
        formData.append('departmentId', selectedDepartment);
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await collegeAPI.uploadStudents(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setUploadResult(response.data);
      
      // Show success message
      toast.success(`🎉 ${response.data.uploaded} students uploaded successfully!`);
      
      // Show errors if any
      if (response.data.errors && response.data.errors.length > 0) {
        const duplicateErrors = response.data.errors.filter(e => e.toLowerCase().includes('duplicate'));
        const otherErrors = response.data.errors.filter(e => !e.toLowerCase().includes('duplicate'));
        
        if (duplicateErrors.length > 0) {
          toast.error(`⚠️ ${duplicateErrors.length} duplicate(s) found in CSV - check results below`, {
            duration: 5000
          });
        }
        
        if (otherErrors.length > 0) {
          toast.error(`⚠️ ${otherErrors.length} error(s) occurred - check results below`, {
            duration: 5000
          });
        }
      }
      
             // Show department stats if available
       if (response.data.departmentStats) {
         const statsMessage = Object.entries(response.data.departmentStats)
           .map(([dept, count]) => `${dept}: ${count} students`)
           .join(', ');
         toast.success(`📊 Uploaded: ${statsMessage}`);
       }
       
       // Show auto-created departments if any
       if (response.data.autoCreatedDepartments) {
         const deptMessage = response.data.autoCreatedDepartments.join(', ');
         toast.success(`🏢 Auto-created departments: ${deptMessage}`);
       }
      
      onSuccess();
      // Refresh overview if available
      if (window.refreshOverview) {
        window.refreshOverview();
      }
      
      // Don't close immediately, show results first
      setTimeout(() => {
        onClose();
        resetForm();
      }, 3000);
      
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      
      const errorData = error.response?.data;
      const message = errorData?.message || 'Failed to upload students';
      
      // Handle duplicate errors specially
      if (errorData?.errors && errorData.errors.length > 0) {
        setUploadResult({
          uploaded: 0,
          errors: errorData.errors,
          message: message
        });
        toast.error(`❌ ${message}`, { duration: 6000 });
      } else {
        toast.error(`❌ ${message}`);
      }
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setUploadResult(null);
    setSelectedDepartment('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    let csvContent;
    
    if (uploadType === 'same_department') {
      csvContent = `usn,name,email,phone,address
1MS20CS001,John Doe,john.doe@example.com,+91-9876543210,Bangalore
1MS20CS002,Jane Smith,jane.smith@example.com,+91-9876543211,Mumbai
1MS20CS003,Bob Johnson,bob.johnson@example.com,+91-9876543212,Delhi`;
         } else {
       csvContent = `usn,name,email,department,phone,address
1MS20CS001,John Doe,john.doe@example.com,Computer Science,+91-9876543210,Bangalore
1MS20EE001,Jane Smith,jane.smith@example.com,Electrical Engineering,+91-9876543211,Mumbai
1MS20ME001,Bob Johnson,bob.johnson@example.com,Mechanical Engineering,+91-9876543212,Delhi
1MS20AI001,Alice Brown,alice.brown@example.com,Artificial Intelligence,+91-9876543213,Chennai
1MS20DS001,Charlie Wilson,charlie.wilson@example.com,Data Science,+91-9876543214,Hyderabad`;
     }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_template_${uploadType}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Upload Students</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Type Selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-3">Upload Type</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadType"
                      value="same_department"
                      checked={uploadType === 'same_department'}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-blue-900">Same Department</span>
                      <p className="text-sm text-blue-700">All students in CSV belong to the same department</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadType"
                      value="different_departments"
                      checked={uploadType === 'different_departments'}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-blue-900">Different Departments</span>
                      <p className="text-sm text-blue-700">Students in CSV belong to different departments (requires 'department' column)</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV File</h3>
            <p className="text-gray-600 mb-4">
              Select a CSV file containing student information
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary flex items-center space-x-2 mx-auto"
            >
              <Upload className="w-4 h-4" />
              <span>Choose File</span>
            </button>
            <div className="mt-4">
              <button
                onClick={downloadTemplate}
                className="text-sm text-blue-600 hover:text-blue-500 flex items-center space-x-1 mx-auto"
              >
                <Download className="w-4 h-4" />
                <span>Download Template</span>
              </button>
            </div>
          </div>

          {/* File Info */}
          {selectedFile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">{selectedFile.name}</p>
                  <p className="text-sm text-blue-700">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Department Selection - Only for same department upload */}
          {uploadType === 'same_department' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Building className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-2">Select Department</h4>
                  {departments.length === 0 ? (
                    <p className="text-sm text-blue-700">
                      No departments available. Please create a department first.
                    </p>
                  ) : (
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full mt-2 p-2 border border-blue-300 rounded-lg bg-white text-sm"
                    >
                      <option value="">Select a department</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Available Departments Info - For different departments upload */}
          {uploadType === 'different_departments' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Building className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 mb-2">Department Management</h4>
                  {departments.length === 0 ? (
                    <div className="text-sm text-green-700">
                      <p className="mb-2">No departments available yet.</p>
                      <p className="mb-2">✅ <strong>Auto-Create Feature:</strong> New departments will be automatically created from your CSV!</p>
                    </div>
                  ) : (
                    <div className="text-sm text-green-700">
                      <p className="mb-2">Existing departments:</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {departments.map((dept) => (
                          <span key={dept._id} className="px-2 py-1 bg-green-100 rounded text-xs font-medium">
                            {dept.name}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-green-600">
                        ✅ <strong>Auto-Create Feature:</strong> New departments will be automatically created if they don't exist!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CSV Requirements */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 mb-2">CSV Requirements</h4>
                                 <ul className="text-sm text-yellow-800 space-y-1">
                   <li>• Required columns: USN, Name, Email</li>
                   {uploadType === 'different_departments' && (
                     <li>• Required column: Department (new departments will be auto-created)</li>
                   )}
                   <li>• Optional columns: Phone, Address</li>
                   <li>• Maximum file size: 5MB</li>
                   <li>• Students will set their interests and skills during login</li>
                 </ul>
              </div>
            </div>
          </div>

          {/* Preview Data */}
          {previewData.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Preview (First 5 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(previewData[0] || {}).map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">
                          {header.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <div className={uploadResult.uploaded > 0 ? "bg-green-50 border border-green-200 rounded-lg p-4" : "bg-red-50 border border-red-200 rounded-lg p-4"}>
              <div className="flex items-start space-x-3">
                {uploadResult.uploaded > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  {uploadResult.uploaded > 0 ? (
                    <>
                      <h4 className="font-medium text-green-900 mb-2">Upload Results</h4>
                      <p className="text-sm text-green-700 mb-2">
                        Successfully uploaded {uploadResult.uploaded} students
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-medium text-red-900 mb-2">❌ Upload Rejected</h4>
                      <p className="text-sm text-red-700 mb-2">
                        {uploadResult.message || 'CSV validation failed'}
                      </p>
                    </>
                  )}
                                     {uploadResult.departmentStats && (
                     <div className="text-sm text-green-700">
                       <p className="font-medium mb-1">Department Breakdown:</p>
                       <div className="space-y-1">
                         {Object.entries(uploadResult.departmentStats).map(([dept, count]) => (
                           <div key={dept} className="flex justify-between">
                             <span>{dept}:</span>
                             <span className="font-medium">{count} students</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                   {uploadResult.autoCreatedDepartments && (
                     <div className="text-sm text-blue-700 mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                       <p className="font-medium mb-1">🏢 Auto-Created Departments:</p>
                       <div className="space-y-1">
                         {uploadResult.autoCreatedDepartments.map((dept, index) => (
                           <div key={index} className="flex items-center">
                             <span className="text-blue-600 mr-2">•</span>
                             <span>{dept}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-medium text-red-800 mb-2">
                        ⚠️ Errors ({uploadResult.errors.length}):
                      </p>
                      <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index} className="py-1">
                            • {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Uploading students...</span>
                <span className="text-gray-900">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || (uploadType === 'same_department' && !selectedDepartment) || isLoading}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="spinner mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Upload Students
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentUploadModal; 