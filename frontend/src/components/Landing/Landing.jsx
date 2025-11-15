import { Link } from 'react-router-dom';
import { 
  FiArrowRight, 
  FiCheck, 
  FiUsers,
  FiMessageSquare,
  FiVideo,
  FiCalendar,
  FiSearch,
  FiUserPlus,
  FiBookOpen,
  FiAward,
  FiGlobe,
  FiLayers,
  FiMic,
  FiMonitor,
  FiTrendingUp,
  FiUsers as FiUsersIcon,
  FiLink,
  FiShare2,
  FiFileText
} from 'react-icons/fi';
import logo from '../../assets/campusconnect-logo.svg';

const Landing = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 w-full bg-gray-900/95 backdrop-blur-sm z-50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <Link to="/" className="flex items-center group">
              <img className="h-8 w-auto" src={logo} alt="CampusConnect" />
              <span className="ml-3 text-xl font-semibold text-white group-hover:text-primary transition-colors">CampusConnect</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                How It Works
              </a>
              <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Student Login
              </Link>
              <Link to="/college-login" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                College Login
              </Link>
            </div>
            
            <button className="md:hidden text-gray-300 hover:text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 md:pt-36 md:pb-28">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight">
                Connect, Collaborate & Grow<br />
                <span className="text-primary">Across Campuses</span>
              </h1>
              <p className="mt-6 text-xl text-gray-300 max-w-3xl mx-auto">
                The ultimate platform for students to connect with peers, join events, and collaborate on projects across colleges.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                <Link 
                  to="/login" 
                  className="px-8 py-4 bg-white text-gray-900 text-lg font-semibold rounded-lg hover:bg-gray-100 transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl shadow-gray-200"
                >
                  Student Login
                </Link>
                <Link 
                  to="/college-login" 
                  className="px-8 py-4 border-2 border-gray-700 text-gray-200 text-lg font-semibold rounded-lg hover:bg-gray-800/50 transition-all"
                >
                  College Login
                </Link>
              </div>
              <p className="mt-6 text-sm text-gray-400">
                Students: Ensure your college has registered with CampusConnect
              </p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-900 to-transparent"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Why Choose CampusConnect?</h2>
              <div className="w-20 h-1 bg-primary mx-auto mb-6"></div>
              <p className="text-lg text-gray-400">Empowering students and colleges to connect and collaborate like never before</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 - Student Connections */}
              <div className="bg-gray-800 p-8 rounded-xl hover:bg-gray-800/80 transition-all border border-gray-700 hover:border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6">
                  <FiUsers className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Connect with Students</h3>
                <p className="text-gray-400 mb-4">Connect with students who share your interests, both within and outside your college.</p>
                <ul className="space-y-2">
                  {['Interest-based search', 'Cross-college networking', 'Skill-based matching', 'Group collaboration'].map((item, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Feature 2 - College Events */}
              <div className="bg-gray-800 p-8 rounded-xl hover:bg-gray-800/80 transition-all border border-gray-700 hover:border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6">
                  <FiCalendar className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Campus Events</h3>
                <p className="text-gray-400 mb-4">Discover and join events across multiple colleges or create your own.</p>
                <ul className="space-y-2">
                  {['Event discovery', 'Live streaming', 'RSVP system', 'Cross-college events'].map((item, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Feature 3 - Video Collaboration */}
              <div className="bg-gray-800 p-8 rounded-xl hover:bg-gray-800/80 transition-all border border-gray-700 hover:border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6">
                  <FiVideo className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Seamless Video Calls</h3>
                <p className="text-gray-400 mb-4">High-quality video calls with screen sharing for effective collaboration.</p>
                <ul className="space-y-2">
                  {['One-on-one calls', 'Group video meetings', 'Screen sharing', 'Virtual classrooms'].map((item, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Feature 4 - College Portal */}
              <div className="bg-gray-800 p-8 rounded-xl hover:bg-gray-800/80 transition-all border border-gray-700 hover:border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6">
                  <FiBookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">College Portal</h3>
                <p className="text-gray-400 mb-4">Comprehensive tools for colleges to manage and engage their students.</p>
                <ul className="space-y-2">
                  {['Student management', 'Event hosting', 'Announcements', 'Analytics dashboard'].map((item, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Feature 5 - Skill Showcase */}
              <div className="bg-gray-800 p-8 rounded-xl hover:bg-gray-800/80 transition-all border border-gray-700 hover:border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6">
                  <FiAward className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Skill Showcase</h3>
                <p className="text-gray-400 mb-4">Highlight your skills and discover opportunities to collaborate.</p>
                <ul className="space-y-2">
                  {['Skill tagging', 'Project collaboration', 'Portfolio showcase', 'Peer recognition'].map((item, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Feature 6 - Global Network */}
              <div className="bg-gray-800 p-8 rounded-xl hover:bg-gray-800/80 transition-all border border-gray-700 hover:border-primary/30">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6">
                  <FiGlobe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Global Reach</h3>
                <p className="text-gray-400 mb-4">Connect with students and colleges from around the world.</p>
                <ul className="space-y-2">
                  {['Cross-cultural exchange', 'International events', 'Global projects', 'Networking opportunities'].map((item, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <FiCheck className="text-green-500 mr-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          {/* CTA Section */}
          <div className="mt-20 bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 md:p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-6">Ready to join the CampusConnect community?</h3>
            <p className="text-gray-200 mb-8 max-w-2xl mx-auto">Connect with peers, join events, and collaborate across colleges.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                to="/student-register" 
                className="px-8 py-4 bg-white text-gray-900 text-lg font-semibold rounded-lg hover:bg-gray-100 transition-all"
              >
                Sign Up as Student
              </Link>
              <Link 
                to="/college-register" 
                className="px-8 py-4 border-2 border-white/20 text-white text-lg font-semibold rounded-lg hover:bg-white/10 transition-all"
              >
                Register Your College
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/80">Colleges: Reach students across multiple institutions with your events and announcements</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary font-medium text-sm uppercase tracking-wider">Getting Started</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">How CampusConnect Works</h2>
            <div className="w-20 h-1 bg-primary mx-auto mb-6"></div>
            <p className="text-lg text-gray-400">A simple process to connect and collaborate across campuses</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {/* For Students */}
            <div className="bg-gray-700/50 p-8 rounded-xl">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary mx-auto mb-6">
                <FiUserPlus className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-6">For Students</h3>
              <ul className="space-y-4">
                {[
                  'Create your profile with your skills and interests',
                  'Search and connect with students from any college',
                  'Join or create interest-based groups',
                  'Participate in cross-college events and hackathons',
                  'Collaborate on projects and share knowledge'
                ].map((step, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-medium">
                        {index + 1}
                      </div>
                    </div>
                    <p className="ml-3 text-gray-300">{step}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8 text-center">
                <Link 
                  to="/student-register" 
                  className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                >
                  Sign up as student <FiArrowRight className="ml-2" />
                </Link>
              </div>
            </div>
            
            {/* For Colleges */}
            <div className="bg-gray-700/50 p-8 rounded-xl">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary mx-auto mb-6">
                <FiLayers className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-6">For Colleges</h3>
              <ul className="space-y-4">
                {[
                  'Register your institution on CampusConnect',
                  'Verify your college domain for student sign-ups',
                  'Create and promote events to students across colleges',
                  'Host live sessions and webinars',
                  'Manage student activities and engagement'
                ].map((step, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-medium">
                        {index + 1}
                      </div>
                    </div>
                    <p className="ml-3 text-gray-300">{step}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8 text-center">
                <Link 
                  to="/college-register" 
                  className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                >
                  Register your college <FiArrowRight className="ml-2" />
                </Link>
              </div>
            </div>
            
            {/* For Everyone */}
            <div className="bg-gray-700/50 p-8 rounded-xl">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary mx-auto mb-6">
                <FiGlobe className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-6">Connect & Collaborate</h3>
              <ul className="space-y-4">
                {[
                  'Find study partners with similar academic interests',
                  'Join virtual study groups across colleges',
                  'Participate in inter-college competitions',
                  'Attend workshops and seminars from top institutions',
                  'Build your professional network early'
                ].map((step, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-medium">
                        {index + 1}
                      </div>
                    </div>
                    <p className="ml-3 text-gray-300">{step}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8 text-center">
                <Link 
                  to="/features" 
                  className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                >
                  Explore features <FiArrowRight className="ml-2" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <FiUsers className="w-6 h-6" />,
                title: 'Create Account',
                description: 'Sign up with your institutional email to get started.'
              },
              {
                icon: <FiFileText className="w-6 h-6" />,
                title: 'Complete Profile',
                description: 'Add your details and customize your preferences.'
              },
              {
                icon: <FiMessageSquare className="w-6 h-6" />,
                title: 'Start Engaging',
                description: 'Join classes, connect with peers, and access resources.'
              }
            ].map((step, index) => (
              <div key={index} className="bg-gray-700/50 p-8 rounded-xl text-center border border-gray-600/30 hover:border-primary/30 transition-all group">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-300">{step.description}</p>
                <div className="mt-6 text-primary font-medium flex items-center justify-center">
                  Learn more
                  <FiArrowRight className="ml-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Network Visualization */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mt-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Connect with Peers Across Campuses
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Join a network of students from different colleges and collaborate on projects, share knowledge, and grow together.
            </p>
          </div>
          
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                <FiUsersIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Discover Your Network</h3>
              <p className="text-gray-400">Connect with students who share your academic interests and career goals, no matter which college or department they're in.</p>
            </div>
            
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                <FiLink className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Cross-College Projects</h3>
              <p className="text-gray-400">Collaborate on projects with students from different institutions, bringing together diverse skills and perspectives.</p>
            </div>
            
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                <FiShare2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Share Knowledge</h3>
              <p className="text-gray-400">Exchange knowledge, resources, and experiences with a diverse community of learners and educators.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Copyright Footer */}
      <footer className="bg-gray-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} CampusConnect. All rights reserved.
          </p>
        </div>
      </footer>
      </main>
    </div>
  );
};

export default Landing;
