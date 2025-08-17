// 用户相关类型
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'STUDENT' | 'TEACHER';
}

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}

// 课程相关类型
export interface Course {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
  currentStudents: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  classroom?: string;
  teacherId: string;
  teacher: User;
  students: StudentCourse[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentCourse {
  id: string;
  studentId: string;
  courseId: string;
  status: 'ENROLLED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED';
  enrolledAt: string;
  student: User;
  course: Course;
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  maxStudents?: number;
  classroom?: string;
  teacherId?: string;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  maxStudents?: number;
  classroom?: string;
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

// 课包相关类型
export interface CoursePackage {
  id: string;
  name: string;
  description?: string;
  totalHours: number;
  usedHours: number;
  price: number;
  validDays: number;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  studentId: string;
  purchasedAt: string;
  expiresAt: string;
  student: User;
  payments: Payment[];
}

export interface CreatePackageRequest {
  name: string;
  description?: string;
  totalHours: number;
  price: number;
  validDays: number;
  studentId: string;
}

export interface PurchasePackageRequest {
  name: string;
  description?: string;
  totalHours: number;
  price: number;
  validDays: number;
  paymentMethod: 'CASH' | 'WECHAT' | 'ALIPAY' | 'BANK_TRANSFER';
}

export interface ConsumeHoursRequest {
  hours: number;
  courseId: string;
}

// 出勤相关类型
export interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
  notes?: string;
  recordedAt: string;
  student: User;
  course: Course;
}

export interface CreateAttendanceRequest {
  studentId: string;
  courseId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
  notes?: string;
}

export interface BatchAttendanceRequest {
  courseId: string;
  records: {
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
    notes?: string;
  }[];
}

export interface UpdateAttendanceRequest {
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
  notes?: string;
}

// 支付相关类型
export interface Payment {
  id: string;
  amount: number;
  method: 'CASH' | 'WECHAT' | 'ALIPAY' | 'BANK_TRANSFER';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  packageId?: string;
  studentId: string;
  paidAt: string;
  student: User;
  package?: CoursePackage;
}

export interface CreatePaymentRequest {
  amount: number;
  method: 'CASH' | 'WECHAT' | 'ALIPAY' | 'BANK_TRANSFER';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  studentId: string;
  packageId?: string;
  notes?: string;
}

export interface UpdatePaymentStatusRequest {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  notes?: string;
}

// 统计相关类型
export interface OverviewStatistics {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalPackages: number;
  totalPayments: number;
  totalRevenue: number;
  totalHours: number;
}

export interface DailyConsumptionStat {
  date: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: string;
}

export interface MonthlyHoursStat {
  month: number;
  totalRecords: number;
  consumedHours: number;
}

export interface MonthlyRevenueStat {
  month: number;
  paymentCount: number;
  totalRevenue: number;
}

export interface TeacherStat {
  id: string;
  name: string;
  email: string;
  totalCourses: number;
  coursesWithAttendance: number;
  totalAttendanceRecords: number;
  presentRecords: number;
  absentRecords: number;
  attendanceRate: string;
}

export interface StudentStat {
  id: string;
  name: string;
  email: string;
  enrolledCourses: number;
  attendedCourses: number;
  totalAttendanceRecords: number;
  presentRecords: number;
  absentRecords: number;
  lateRecords: number;
  leaveRecords: number;
  attendanceRate: string;
}

export interface CourseStat {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
  currentStudents: number;
  status: string;
  teacherName: string;
  attendanceRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: string;
  enrollmentRate: string;
}

export interface PackageStat {
  id: string;
  name: string;
  totalHours: number;
  usedHours: number;
  remainingHours: number;
  price: number;
  status: string;
  purchasedAt: string;
  expiresAt: string;
  studentName: string;
  studentEmail: string;
  usageRate: string;
}

// 分页相关类型
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  errors?: any[];
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

// 通用类型
export interface SelectOption {
  label: string;
  value: string | number;
}

export interface TableColumn {
  title: string;
  dataIndex: string;
  key: string;
  render?: (text: any, record: any) => any;
  sorter?: boolean;
  filters?: SelectOption[];
  onFilter?: (value: any, record: any) => boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'textarea' | 'number';
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  rules?: any[];
} 