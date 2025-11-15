import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema({
    collegeName:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    adminName:{
        type: String,
        required: true, 
        trim: true
    },
    adminEmail:{
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    otp:{
        type: String,
        default: '',
        trim: true
    },
    password:{
        type: String,
        required: true,
        trim: true
    },
    collegeVision:{
        type: String,
        default: '',
        trim: true
    },
    collegeType:{
        type: String,
        default: 'Private',
        enum: ['Private', 'Public'],
        trim: true
    },
    collegeAddress:{
        type: String,
        required: true,
        trim: true
    },
    departments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    }],
    collegeLink:{
        type: String,
        default: '',
        trim: true
    },
    collegeLogo:{
        type: String,
        default: '',
        trim: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    totalStudents: {
        type: Number,
        default: 0
    }
},{timestamps: true});

export default mongoose.model('College', collegeSchema);