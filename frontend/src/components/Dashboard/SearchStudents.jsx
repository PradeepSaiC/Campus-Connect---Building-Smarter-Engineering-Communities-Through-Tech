import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore.js';

import { studentAPI, chatAPI, chatRequestAPI, interestsAPI } from '../../services/api.js';
import { toast } from 'react-hot-toast';
import { Search, Users, MessageCircle, GraduationCap, Building } from 'lucide-react';
import SendRequestModal from '../Requests/SendRequestModal.jsx';

const SearchStudents = () => {
  const { user } = useAuthStore();
  const [interests, setInterests] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [requestType, setRequestType] = useState('chat');
  const [onlyOtherColleges, setOnlyOtherColleges] = useState(false);
  const [chatPartnerIds, setChatPartnerIds] = useState(new Set());
  const [pendingPartnerIds, setPendingPartnerIds] = useState(new Set());

  // Fetch all interests (including custom ones)
  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const response = await interestsAPI.getAll();
        setInterests(response.data?.interests || []);
      } catch (error) {
        console.error('Error fetching interests:', error);
        // Fallback to default interests
        setInterests([
          'Artificial Intelligence',
          'Machine Learning',
          'Data Science',
          'Web Development',
          'Mobile Development',
          'Cybersecurity',
          'Cloud Computing',
          'DevOps',
          'Blockchain',
          'IoT',
          'Robotics',
          'Game Development',
          'UI/UX Design',
          'Digital Marketing',
          'Business Analytics'
        ]);
      }
    };
    fetchInterests();
  }, []);

  const handleInterestToggle = (interest) => {
    setSelectedInterests(prev => (prev.includes(interest) ? [] : [interest]));
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const interestsString = selectedInterests.join(',');
      const response = await studentAPI.searchByInterests(interestsString);
      // Normalize response shape
      const list = Array.isArray(response?.data) ? response.data : (response?.data?.students || []);
      // Filter out self and optionally same-college students, and enforce selected interest if present
      const myId = String(user?._id || user?.id || '');
      const getId = (v) => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        return String(v._id || v.id || '');
      };
      const myCollegeId = getId(user?.college);
      const normalize = (s) => String(s || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
      const selected = normalize(selectedInterests[0] || '');
      const filtered = list
        .filter((s) => String(s?._id) !== myId)
        .filter((s) => {
          if (onlyOtherColleges) {
            const sCollegeId = getId(s.college);
            if (sCollegeId === myCollegeId) return false;
          }
          return true;
        })
        .filter((s) => {
          if (!selected) return true;
          const ints = Array.isArray(s?.interests) ? s.interests : [];
          return ints.some((i) => {
            const ni = normalize(i);
            return ni === selected || ni.includes(selected) || selected.includes(ni);
          });
        })
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching students:', error);
      toast.error('❌ Failed to search students');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setSelectedInterests([]);
    await handleSearch();
  };

  const handleSendRequest = (student, type) => {
    setSelectedStudent(student);
    setRequestType(type);
    setShowRequestModal(true);
  };

  const openChatWith = async (student) => {
    try {
      // Ensure a chat exists (idempotent on backend ideally)
      await chatAPI.createChat(student._id);
    } catch (_) {}
    // Ask Dashboard/ChatInterface to switch to chat and focus this user
    try {
      window.dispatchEvent(new CustomEvent('open_chat_with', { detail: { userId: String(student._id) } }));
    } catch (_) {}
  };

  // Initial search on mount
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search whenever interests array changes (value or length)
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterests]);

  // Auto-search whenever onlyOtherColleges toggles, ensuring latest state is used
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyOtherColleges]);

  // Load existing chats and pending requests to adjust visibility of Request Chat button
  useEffect(() => {
    (async () => {
      try {
        // Existing chats
        const chatsRes = await chatAPI.getChats();
        const myId = user?._id || user?.id;
        const partners = new Set();
        (chatsRes.data || []).forEach((c) => {
          const other = Array.isArray(c.participants) ? c.participants.find(p => String(p._id) !== String(myId)) : null;
          if (other?._id) partners.add(String(other._id));
        });
        setChatPartnerIds(partners);

        // Pending requests (both directions)
        const sent = await chatRequestAPI.getRequests('sent');
        const received = await chatRequestAPI.getRequests('received');
        const pending = new Set();
        const pushIfPending = (r) => {
          const status = String(r?.status || '').toLowerCase();
          if (status === 'pending') {
            const otherId = String(r?.sender?._id === String(myId) ? r?.receiver?._id : r?.sender?._id || '');
            if (otherId) pending.add(otherId);
          }
        };
        (sent?.data || []).forEach(pushIfPending);
        (received?.data || []).forEach(pushIfPending);
        setPendingPartnerIds(pending);
      } catch (_) {}
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Find Students</h1>
        <p className="opacity-70 mt-1">
          Discover students across colleges. Select interests to filter or show all students.
        </p>
      </div>

      {/* Controls Top Bar */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm opacity-70">{searchResults.length} students found</div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedInterests[0] || ''}
              className="select select-bordered select-sm"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                handleInterestToggle(val);
              }}
            >
              <option value="" disabled>
                Select interest
              </option>
              {interests.map((it) => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </select>
            {/* Selected interest is reflected directly in the dropdown; no extra tags */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyOtherColleges}
                onChange={(e) => {
                  setOnlyOtherColleges(e.target.checked);
                }}
                className="checkbox checkbox-primary checkbox-sm"
              />
              <span className="text-sm">Only other colleges</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200">
        <div className="p-6 border-b border-base-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Students</h2>
          <div className="text-sm opacity-70">{searchResults.length} results</div>
        </div>
        <div className="p-6">
              {loading ? (
                <div className="text-center opacity-70 py-12">
                  <span className="loading loading-spinner mx-auto mb-4"></span>
                  <p>Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center opacity-70 py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p>
                    {selectedInterests.length === 0 
                      ? 'No students found in the system' 
                      : 'No students found with selected interests'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {searchResults.map((student) => (
                    <div
                      key={student._id}
                      className="bg-base-200 rounded-lg p-4 hover:bg-base-300 transition-colors duration-200"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-base-300 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{student.name}</h3>
                          <p className="text-sm opacity-70 truncate">{student.usn}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Building className="w-3 h-3 opacity-60" />
                            <span className="text-xs opacity-70">{student.college?.collegeName}</span>
                          </div>

                          {student.interests?.length > 0 && (
                            <div className="mt-3">
                              <div className="flex flex-wrap gap-1">
                                {student.interests.slice(0, 3).map((interest, index) => (
                                  <span key={index} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">
                                    {interest}
                                  </span>
                                ))}
                                {student.interests.length > 3 && (
                                  <span className="px-2 py-1 bg-base-300 text-base-content/70 text-xs rounded-full">
                                    +{student.interests.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 space-y-2">
                            {chatPartnerIds.has(String(student._id)) ? (
                              <button
                                onClick={() => openChatWith(student)}
                                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm rounded-lg btn btn-outline btn-success"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>Chat</span>
                              </button>
                            ) : pendingPartnerIds.has(String(student._id)) ? (
                              <div className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm rounded-lg btn btn-outline btn-warning">
                                <MessageCircle className="w-4 h-4" />
                                <span>Request Pending</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSendRequest(student, 'chat')}
                                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm rounded-lg btn btn-primary"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>Request Chat</span>
                              </button>
                            )}
                            {/* Video call request removed per requirement */}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </div>

      {/* Request Modal */}
      <SendRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        student={selectedStudent}
        requestType={requestType}
      />
    </div>
  );
};

export default SearchStudents; 