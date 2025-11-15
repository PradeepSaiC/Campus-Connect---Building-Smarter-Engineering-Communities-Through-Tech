import { X, GraduationCap, Building, MessageCircle, MapPin, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { chatAPI, chatRequestAPI, collegeAPI } from '../../services/api.js';
import SendRequestModal from '../Requests/SendRequestModal.jsx';

const StudentProfileModal = ({ isOpen, onClose, student }) => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('chat');
  const [hasActiveChat, setHasActiveChat] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [collegeInfo, setCollegeInfo] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Check existing chats
        const chatsRes = await chatAPI.getChats();
        const exists = (chatsRes?.data || []).some((c) =>
          Array.isArray(c.participants) && c.participants.some((p) => String(p._id) === String(student._id))
        );
        if (mounted) setHasActiveChat(exists);
        // Check pending requests both directions
        const [sent, received] = await Promise.all([
          chatRequestAPI.getRequests('sent'),
          chatRequestAPI.getRequests('received')
        ]);
        const isPending = (list) =>
          (list || []).some((r) => String(r?.sender?._id) === String(student._id) || String(r?.receiver?._id) === String(student._id))
            && (list || []).some((r) => String(r?.status || '').toLowerCase() === 'pending');
        const pending = isPending(sent?.data) || isPending(received?.data);
        if (mounted) setHasPendingRequest(pending);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [isOpen, student?._id]);

  // Load full college details for the student (if available)
  useEffect(() => {
    let mounted = true;
    const getId = (v) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      return String(v._id || v.id || '');
    };
    (async () => {
      try {
        const cid = getId(student?.college);
        if (!isOpen || !cid) { if (mounted) setCollegeInfo(null); return; }
        const resp = await collegeAPI.getOne(cid);
        if (!mounted) return;
        setCollegeInfo(resp?.data || null);
      } catch (_) {
        if (mounted) setCollegeInfo(null);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, student?.college]);

  const openRequest = (type) => {
    setRequestType(type);
    setShowRequestModal(true);
  };

  const openChatWith = async () => {
    try { await chatAPI.createChat(student._id); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('open_chat_with', { detail: { userId: String(student._id) } })); } catch (_) {}
    try { if (onClose) onClose(); } catch (_) {}
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-base-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-base-300 rounded-full flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{student?.name}</h3>
              <p className="text-sm opacity-70">{student?.usn}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-base-200">
            <X className="w-5 h-5 opacity-60" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-2 text-sm opacity-70">
            <Building className="w-4 h-4 opacity-60" />
            <span>{student?.college?.collegeName}</span>
          </div>

          {student?.department?.name && (
            <div className="text-sm opacity-70">Department: {student.department.name}</div>
          )}

          {collegeInfo && (
            <div className="mt-2 border border-base-200 rounded-lg p-3 bg-base-100">
              <div className="text-sm font-medium mb-2">College Details</div>
              <div className="space-y-1 text-sm">
                <div className="opacity-80">Name: {String(collegeInfo?.collegeName || '')}</div>
                {collegeInfo?.collegeType && (
                  <div className="opacity-70">Type: {String(collegeInfo.collegeType)}</div>
                )}
                {collegeInfo?.collegeAddress && (
                  <div className="flex items-center gap-2 opacity-70">
                    <MapPin className="w-3 h-3 opacity-60" />
                    <span className="truncate">{String(collegeInfo.collegeAddress)}</span>
                  </div>
                )}
                {(Array.isArray(collegeInfo?.departments) && collegeInfo.departments.length >= 0) && (
                  <div className="opacity-70">Departments: {collegeInfo.departments.length}</div>
                )}
                {collegeInfo?.website && (
                  <a href={collegeInfo.website} target="_blank" rel="noreferrer" className="link link-hover text-indigo-300 inline-flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Visit Website
                  </a>
                )}
              </div>
            </div>
          )}

          {Array.isArray(student?.interests) && student.interests.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Interests</div>
              <div className="flex flex-wrap gap-1">
                {student.interests.map((i, idx) => (
                  <span key={idx} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">{i}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-base-200 flex items-center gap-3">
          {hasActiveChat ? (
            <button onClick={openChatWith} className="flex-1 btn btn-success">
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
          ) : hasPendingRequest ? (
            <div className="flex-1 btn btn-warning btn-outline">
              <MessageCircle className="w-4 h-4" />
              Request Pending
            </div>
          ) : (
            <button
              onClick={() => openRequest('chat')}
              className="flex-1 btn btn-primary"
            >
              <MessageCircle className="w-4 h-4" />
              Request Chat
            </button>
          )}
        </div>
      </div>

      <SendRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        student={student}
        requestType={requestType}
      />
    </div>
  );
};

export default StudentProfileModal;
