import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import models
import Student from './src/model/student.schema.js';
import College from './src/model/college.schema.js';
import Department from './src/model/department.schema.js';
import Event from './src/model/event.schema.js';

dotenv.config();

const sampleColleges = [
  {
    collegeName: "University of Technology",
    adminName: "Dr. John Smith",
    adminEmail: "admin@universitytech.edu",
    password: "admin123",
    collegeAddress: "123 Tech Street, Tech City, TC 12345",
    collegeType: "Public",
    collegeVision: "Empowering students through technology and innovation",
    isVerified: true,
    totalStudents: 0
  },
  {
    collegeName: "Institute of Engineering",
    adminName: "Prof. Sarah Johnson",
    adminEmail: "admin@instituteeng.edu",
    password: "admin123",
    collegeAddress: "456 Engineering Ave, Engineer City, EC 67890",
    collegeType: "Private",
    collegeVision: "Excellence in engineering education and research",
    isVerified: true,
    totalStudents: 0
  },
  {
    collegeName: "Business School International",
    adminName: "Dr. Michael Brown",
    adminEmail: "admin@businessschool.edu",
    password: "admin123",
    collegeAddress: "789 Business Blvd, Commerce City, CC 11111",
    collegeType: "Private",
    collegeVision: "Developing future business leaders",
    isVerified: true,
    totalStudents: 0
  }
];

const sampleDepartments = [
  { name: "Computer Science", description: "Computer Science and Engineering", hod: "Dr. Alice Wilson" },
  { name: "Information Technology", description: "Information Technology", hod: "Dr. Bob Davis" },
  { name: "Electronics and Communication", description: "Electronics and Communication Engineering", hod: "Dr. Carol Miller" },
  { name: "Mechanical Engineering", description: "Mechanical Engineering", hod: "Dr. David Garcia" },
  { name: "Business Administration", description: "Business Administration", hod: "Dr. Emma Taylor" },
  { name: "Data Science", description: "Data Science and Analytics", hod: "Dr. Frank Anderson" }
];

const sampleStudents = [
  {
    usn: "UT001",
    name: "Alice Johnson",
    email: "alice.johnson@universitytech.edu",
    phone: "+1-555-0101",
    address: "123 Student St, Tech City",
    interests: ["Artificial Intelligence", "Machine Learning", "Web Development"],
    skills: ["Python", "JavaScript", "React", "TensorFlow"],
    isRegistered: true
  },
  {
    usn: "UT002",
    name: "Bob Smith",
    email: "bob.smith@universitytech.edu",
    phone: "+1-555-0102",
    address: "456 Learning Ave, Tech City",
    interests: ["Data Science", "Cloud Computing", "DevOps"],
    skills: ["Python", "AWS", "Docker", "SQL"],
    isRegistered: true
  },
  {
    usn: "IE001",
    name: "Carol Davis",
    email: "carol.davis@instituteeng.edu",
    phone: "+1-555-0201",
    address: "789 Engineer Blvd, Engineer City",
    interests: ["IoT", "Robotics", "Embedded Systems"],
    skills: ["C++", "Arduino", "Linux", "Git"],
    isRegistered: true
  },
  {
    usn: "IE002",
    name: "David Wilson",
    email: "david.wilson@instituteeng.edu",
    phone: "+1-555-0202",
    address: "321 Innovation St, Engineer City",
    interests: ["Cybersecurity", "Blockchain", "Mobile Development"],
    skills: ["Java", "Kotlin", "Flutter", "Linux"],
    isRegistered: true
  },
  {
    usn: "BS001",
    name: "Emma Brown",
    email: "emma.brown@businessschool.edu",
    phone: "+1-555-0301",
    address: "654 Business Way, Commerce City",
    interests: ["Digital Marketing", "Business Analytics", "Finance"],
    skills: ["Excel", "Tableau", "SQL", "Agile"],
    isRegistered: true
  },
  {
    usn: "BS002",
    name: "Frank Miller",
    email: "frank.miller@businessschool.edu",
    phone: "+1-555-0302",
    address: "987 Commerce Dr, Commerce City",
    interests: ["UI/UX Design", "Project Management", "Human Resources"],
    skills: ["Figma", "Adobe XD", "Scrum", "Leadership"],
    isRegistered: true
  }
];

const sampleEvents = [
  {
    title: "AI and Machine Learning Workshop",
    description: "A comprehensive workshop on AI and ML fundamentals, hands-on projects, and industry applications.",
    type: "workshop",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    duration: 180,
    maxParticipants: 50,
    currentParticipants: 0,
    tags: ["AI", "Machine Learning", "Python", "Data Science"],
    isLive: false,
    isCompleted: false
  },
  {
    title: "Web Development Bootcamp",
    description: "Learn modern web development with React, Node.js, and MongoDB. Build real-world projects.",
    type: "webinar",
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    duration: 240,
    maxParticipants: 100,
    currentParticipants: 0,
    tags: ["Web Development", "React", "Node.js", "MongoDB"],
    isLive: false,
    isCompleted: false
  },
  {
    title: "Cultural Fest 2024",
    description: "Annual cultural festival featuring performances, competitions, and food stalls from different regions.",
    type: "cultural",
    date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
    duration: 480,
    maxParticipants: 500,
    currentParticipants: 0,
    tags: ["Cultural", "Festival", "Entertainment", "Community"],
    isLive: false,
    isCompleted: false
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campusconnect');
    console.log('Connected to MongoDB');

    // Clear existing data
    await Student.deleteMany({});
    await Department.deleteMany({});
    await College.deleteMany({});
    await Event.deleteMany({});
    console.log('Cleared existing data');

    // Create colleges
    const colleges = [];
    for (const collegeData of sampleColleges) {
      const hashedPassword = await bcrypt.hash(collegeData.password, 10);
      const college = new College({
        ...collegeData,
        password: hashedPassword
      });
      await college.save();
      colleges.push(college);
      console.log(`Created college: ${college.collegeName}`);
    }

    // Create departments for each college
    const departments = [];
    for (let i = 0; i < colleges.length; i++) {
      const college = colleges[i];
      const deptCount = i === 0 ? 3 : i === 1 ? 2 : 1; // Different number of departments per college
      
      for (let j = 0; j < deptCount; j++) {
        const deptIndex = (i * 2) + j;
        const department = new Department({
          ...sampleDepartments[deptIndex],
          college: college._id,
          totalStudents: 0
        });
        await department.save();
        departments.push(department);
        
        // Add department to college
        college.departments.push(department._id);
        await college.save();
        
        console.log(`Created department: ${department.name} for ${college.collegeName}`);
      }
    }

    // Create students
    const students = [];
    for (let i = 0; i < sampleStudents.length; i++) {
      const studentData = sampleStudents[i];
      const collegeIndex = Math.floor(i / 2); // 2 students per college
      const deptIndex = Math.floor(i / 2) * 2; // First department of each college
      
      const student = new Student({
        ...studentData,
        college: colleges[collegeIndex]._id,
        department: departments[deptIndex]._id,
        password: await bcrypt.hash('student123', 10)
      });
      await student.save();
      students.push(student);
      
      // Update department and college student counts
      departments[deptIndex].totalStudents += 1;
      await departments[deptIndex].save();
      
      colleges[collegeIndex].totalStudents += 1;
      await colleges[collegeIndex].save();
      
      console.log(`Created student: ${student.name} (${student.usn})`);
    }

    // Create events
    for (let i = 0; i < sampleEvents.length; i++) {
      const eventData = sampleEvents[i];
      const event = new Event({
        ...eventData,
        host: colleges[i % colleges.length]._id
      });
      await event.save();
      console.log(`Created event: ${event.title}`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${colleges.length} colleges created`);
    console.log(`- ${departments.length} departments created`);
    console.log(`- ${students.length} students created`);
    console.log(`- ${sampleEvents.length} events created`);
    
    console.log('\n🔑 Test Credentials:');
    console.log('\nCollege Administrators:');
    colleges.forEach(college => {
      console.log(`- ${college.collegeName}: ${college.adminEmail} / admin123`);
    });
    
    console.log('\nStudents:');
    students.forEach(student => {
      console.log(`- ${student.name}: ${student.usn} / student123`);
    });

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the seeder
seedDatabase();
