import { useEffect, useState } from 'react';
import { collegeAPI, departmentAPI } from '../../services/api.js';
import { ArrowLeft, Building, MapPin, ExternalLink, GraduationCap } from 'lucide-react';

const CollegeDetails = ({ collegeId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [college, setCollege] = useState(null);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await collegeAPI.getById(collegeId);
        if (!mounted) return;
        setCollege(resp?.data || null);
      } catch (_) {
        setCollege(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [collegeId]);

  // Fetch departments list explicitly to ensure it's populated
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await departmentAPI.getByCollege(collegeId);
        if (!mounted) return;
        const list = resp?.data?.departments || resp?.data || [];
        setDepartments(Array.isArray(list) ? list : []);
      } catch (_) {
        if (mounted) setDepartments([]);
      }
    })();
    return () => { mounted = false; };
  }, [collegeId]);

  if (!collegeId) {
    return (
      <div className="space-y-4">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft className="w-4 h-4" />Back</button>
        <div className="opacity-70">No college selected.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold">College Details</h1>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200">
        <div className="p-6 border-b border-base-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-base-300 rounded-lg flex items-center justify-center">
              <Building className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="text-xl font-semibold">{college?.collegeName || '—'}</div>
              <div className="text-sm opacity-70">{college?.collegeType || ''}</div>
            </div>
          </div>
          {college?.website && (
            <a href={college.website} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink className="w-4 h-4" /> Website
            </a>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: About and Location */}
          <div className="space-y-4">
            <div className="border border-base-200 rounded-lg p-4 bg-base-100">
              <div className="text-sm font-medium mb-2">About</div>
              <div className="text-sm opacity-80">{college?.about || 'No description available.'}</div>
              {college?.establishedYear && (
                <div className="text-xs opacity-60 mt-2">Established: {college.establishedYear}</div>
              )}
              {college?.accreditation && (
                <div className="text-xs opacity-60">Accreditation: {college.accreditation}</div>
              )}
            </div>

            <div className="border border-base-200 rounded-lg p-4 bg-base-100">
              <div className="text-sm font-medium mb-2">Location</div>
              <div className="flex items-start gap-2 text-sm opacity-80">
                <MapPin className="w-4 h-4 opacity-60 mt-0.5" />
                <span>{college?.collegeAddress || 'Address not available'}</span>
              </div>
            </div>

            {/* Admin details (kept subtle) */}
            <div className="border border-base-200 rounded-lg p-4 bg-base-100">
              <div className="text-sm font-medium mb-2">Administration</div>
              <div className="text-sm opacity-80">Admin Email: {college?.adminEmail || college?.admin?.email || '—'}</div>
              {college?.adminName || college?.admin?.name ? (
                <div className="text-sm opacity-80">Admin Name: {college?.adminName || college?.admin?.name}</div>
              ) : null}
            </div>
          </div>

          {/* Right column: Aim & Vision and Departments */}
          <div className="space-y-4">
            <div className="border border-base-200 rounded-lg p-4 bg-base-100">
              <div className="text-sm font-medium mb-2">Vision</div>
              <div className="text-sm opacity-80">{college?.admin?.vision || college?.vision || '—'}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Departments ({departments.length})</div>
              {departments.length === 0 ? (
                <div className="opacity-70 text-sm">No departments found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {departments.map((dept) => (
                    <div key={dept._id} className="border border-base-200 rounded-lg p-3 flex items-center gap-2 bg-base-100">
                      <GraduationCap className="w-4 h-4 opacity-60" />
                      <div className="text-sm">{dept.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="p-6 pt-0 opacity-70">Loading...</div>
        )}
      </div>
    </div>
  );
};

export default CollegeDetails;
