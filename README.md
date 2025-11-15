# 🎓 CampusConnect - Student Networking Platform

A comprehensive and interactive web-based platform that connects students from various colleges based on their academic interests and institutional affiliations. CampusConnect breaks institutional boundaries and creates a unified digital ecosystem where students can connect, communicate, and collaborate.

## ✨ Key Features

### 🔐 **Authentication & Registration**
- **Student Registration**: USN-based registration with OTP verification
- **College Admin Registration**: College administrators can register their institutions
- **Secure Login**: JWT-based authentication for both students and colleges
- **Interest Selection**: Students select domains of interest during registration

### 🏫 **College Management**
- **College Registration**: Admins can register colleges with detailed information
- **Department Management**: Add and manage departments within colleges
- **Student Upload**: Bulk upload student records via CSV
- **College Directory**: Browse all registered colleges and their departments

### 👥 **Student Discovery**
- **Interest-Based Search**: Find students across colleges by shared interests
- **Smart Search**: Advanced filtering and search capabilities
- **Student Profiles**: View detailed student information and interests
- **Cross-College Connections**: Connect with students from different institutions

### 💬 **Real-Time Communication**
- **Private Chat**: One-on-one messaging between students
- **Real-Time Messaging**: Powered by Socket.IO for instant communication
- **Typing Indicators**: See when someone is typing
- **Online Status**: Real-time online/offline status
- **Message History**: Persistent chat history

### 🎥 **Video Calling**
- **Agora SDK Integration**: High-quality video calling capabilities
- **One-on-One Calls**: Private video conversations
- **Call Controls**: Mute, camera toggle, and other controls

### 📅 **Live Events**
- **Event Hosting**: Colleges can host live-streamed events
- **Event Types**: Webinars, lectures, cultural events, workshops, seminars
- **Event Discovery**: Browse and join upcoming events
- **Live Streaming**: Real-time event streaming capabilities

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express.js** - Server framework
- **MongoDB** + **Mongoose** - Database and ODM
- **Socket.IO** - Real-time communication
- **JWT** + **bcryptjs** - Authentication and security
- **Agora SDK** - Video calling
- **Nodemailer** - Email functionality
- **Cloudinary** - File upload and storage

### Frontend
- **React** + **React Router** - UI framework and routing
- **Zustand** - State management
- **Tailwind CSS** + **DaisyUI** - Styling and components
- **Socket.IO Client** - Real-time communication
- **Agora RTC SDK** - Video calling
- **Axios** - HTTP client

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB (v4.4+)
- npm or yarn

### 1. Clone and Install
```bash
git clone <repository-url>
cd campusconnect

# Backend
cd backend && npm install

# Frontend  
cd ../frontend && npm install
```

### 2. Environment Setup
```bash
# Backend
cd backend
cp env.example .env
# Edit .env with your configuration

# Frontend
cd ../frontend
cp env.example .env
# Edit .env with API URL
```

### 3. Start Services
```bash
# Start MongoDB
mongod

# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2)
cd frontend
npm run dev
```

### 4. Seed Sample Data (Optional)
```bash
cd backend
npm run seed
```

### 5. Access Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

## 📱 Usage Guide

### For Students
1. **Register** with your USN
2. **Set Interests** and skills
3. **Explore Colleges** and departments
4. **Find Students** with similar interests
5. **Start Chatting** and video calls
6. **Join Events** and live streams

### For College Administrators
1. **Register College** account
2. **Add Departments** to your college
3. **Upload Students** via CSV
4. **Host Events** and live streams
5. **Monitor Activity** and engagement

## 🔧 Configuration

### Required Environment Variables

#### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/campusconnect
JWT_SECRET=your-super-secret-jwt-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
PORT=5000
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

### External Services Setup

1. **Agora.io** - Video calling
   - Create account at [agora.io](https://www.agora.io/)
   - Get App ID and Certificate
   - Add to backend .env

2. **Cloudinary** - File storage
   - Create account at [cloudinary.com](https://cloudinary.com/)
   - Get credentials and add to backend .env

3. **Gmail** - Email service
   - Enable 2FA on Gmail
   - Generate App Password
   - Add to backend .env

## 📊 Sample Data

The application includes sample data for testing:
- 3 colleges with different departments
- 6 students with various interests
- Sample events and activities

Run `npm run seed` in the backend directory to populate the database.

## 🔧 API Documentation

### Authentication
- `POST /api/auth/first-login` - Student first login
- `POST /api/auth/verify-otp` - Verify OTP and complete registration
- `POST /api/auth/login` - Student login
- `POST /api/college/register` - College registration
- `POST /api/college/login` - College login

### Students & Colleges
- `GET /api/colleges` - Get all colleges
- `GET /api/students/search` - Search students by interests
- `GET /api/departments/:id/students` - Get department students

### Communication
- `POST /api/chats` - Create chat
- `GET /api/chats` - Get user chats
- `POST /api/video-call/initiate` - Start video call

### Events
- `POST /api/events` - Create event
- `GET /api/events` - Get events
- `POST /api/events/:id/join` - Join event

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```bash
   # Start MongoDB service
   sudo systemctl start mongod
   # or
   brew services start mongodb-community
   ```

2. **Port Already in Use**
   ```bash
   # Kill process on port 5000
   lsof -ti:5000 | xargs kill -9
   ```

3. **Video Calling Not Working**
   - Check Agora credentials in .env
   - Ensure browser permissions for camera/microphone
   - Verify Agora SDK installation

4. **Email Not Sending**
   - Verify Gmail credentials
   - Use App Password instead of regular password
   - Check 2FA is enabled

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Socket.IO** for real-time communication
- **Agora** for video calling capabilities
- **DaisyUI** for beautiful UI components
- **Tailwind CSS** for utility-first styling
- **MongoDB** for database management

---

**Made with ❤️ for the academic community**

For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md) 