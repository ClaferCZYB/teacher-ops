/**
 * TeacherOps 数据模型 — 所有实体类型集中声明
 * 软删除：所有实体携带 deletedAt，null 表示未删除
 */

/** 基础字段（所有业务实体继承） */
export interface BaseEntity {
  id: string
  createdAt: string  // ISO
  updatedAt: string  // ISO
  deletedAt: string | null
}

/* ----------- 教师 ----------- */
export interface Teacher extends BaseEntity {
  name: string
  subject: string        // 默认任教学科
  phone?: string
  email?: string
  note?: string
  preferences: {
    theme: 'light' | 'dark'
    density: 'comfortable' | 'compact'
    defaultClassId?: string | null
    defaultTerm?: string | null
  }
}

/* ----------- 班级 ----------- */
export interface ClassEntity extends BaseEntity {
  name: string                  // 班级名称
  grade: string                 // 高一 / 高二 / 高三
  academicYear: string          // 2024-2025
  term: string                  // 上学期 / 下学期
  isHomeroom: boolean           // 是否班主任班
  subject?: string              // 任教学科
  status: 'active' | 'archived'
  note?: string
  seatRows?: number             // 座位表行数
  seatCols?: number             // 座位表列数
}

/* ----------- 学生 ----------- */
export interface Guardian {
  name: string
  relation?: string        // 与学生关系（父亲 / 母亲 / 爷爷 / 法定监护人…）
  phone?: string
  isPrimary?: boolean      // 主联系人（用于默认显示）
  note?: string
}

export interface Student extends BaseEntity {
  classId: string
  studentNo: string             // 学号
  name: string
  gender: 'male' | 'female' | 'other'
  birthDate?: string | null
  height?: number | null        // 身高 cm（座位表自动排座需要）
  seatRow?: number | null       // 座位表行号 1-based
  seatCol?: number | null       // 座位表列号 1-based
  groupId?: string | null       // 所属小组
  /** 多家长支持（v2+）。老数据迁移时从 guardianName/Phone 单条字段生成第一条 */
  guardians: Guardian[]
  address?: string
  interest?: string             // 兴趣特长
  tags: string[]                // 学生标签
  note?: string                 // 教师备注（教师内部观察）
  status: 'active' | 'transferred' | 'graduated' | 'other'
  /** 兼容旧版：保留单家长字段用于迁移期识别，迁移完成后清空 */
  _legacy?: {
    guardianName?: string
    guardianRelation?: string
    guardianPhone?: string
  }
}

/* ----------- 小组 ----------- */
export interface Group extends BaseEntity {
  classId: string
  name: string
  leaderId?: string | null      // 学生 id
  note?: string
}

/* ----------- 学生成长记录（核心：所有可被时间轴收编的内容） ----------- */
export type RecordType =
  | 'observation'   // 课堂观察
  | 'study'         // 学习情况
  | 'behavior'      // 日常表现
  | 'talk'          // 谈话记录
  | 'home'          // 家校沟通
  | 'attendance'    // 考勤
  | 'reward'        // 奖励
  | 'demerit'       // 处分
  | 'growth'        // 成长事件
  | 'award'         // 荣誉奖项
  | 'punish'        // 扣分
  | 'other'

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  observation: '课堂观察',
  study: '学习情况',
  behavior: '日常表现',
  talk: '谈话记录',
  home: '家校沟通',
  attendance: '考勤',
  reward: '奖励',
  demerit: '处分',
  growth: '成长事件',
  award: '荣誉奖项',
  punish: '扣分',
  other: '其他',
}

export interface StudentRecord extends BaseEntity {
  studentId: string
  classId: string
  type: RecordType
  occurredAt: string            // 事件发生时间（用于时间轴排序）
  title?: string
  content: string
  score?: number                // 加减分（用于积分体系）
  tags: string[]
  followUpAt?: string | null    // 跟进日期
  followUpDone?: boolean
  followUpNote?: string
  /** 引用其它实体的 id（可选） */
  relatedId?: string | null
  relatedType?: 'communication' | 'attendance' | 'grade' | 'assignment' | null
}

/* ----------- 家校沟通 ----------- */
export interface Communication extends BaseEntity {
  studentId: string
  classId: string
  parentName: string
  relation?: string
  contact?: string
  occurredAt: string
  channel: 'phone' | 'wechat' | 'inperson' | 'email' | 'note' | 'other'
  subject: string
  content: string
  parentFeedback?: string
  followUpAt?: string | null
  followUpDone?: boolean
}

/* ----------- 考勤 ----------- */
export type AttendanceStatus = 'present' | 'late' | 'early' | 'leave' | 'absent' | 'other'

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出勤',
  late: '迟到',
  early: '早退',
  leave: '请假',
  absent: '缺勤',
  other: '其他',
}

export interface Attendance extends BaseEntity {
  studentId: string
  classId: string
  date: string                  // YYYY-MM-DD
  status: AttendanceStatus
  remark?: string
}

/* ----------- 成绩 ----------- */
export interface Exam extends BaseEntity {
  classId: string
  name: string                  // 考试名称
  /** 主科目（兼容旧版）；新版考试可绑定多个科目，参见 grade.subject 与 EXAM_SUBJECTS 列表 */
  subject?: string
  /** 本考试包含的科目列表（多科录入的核心） */
  subjects?: string[]
  /** 每科满分（缺省回退到 fullScore） */
  fullScores?: Record<string, number>
  type: 'monthly' | 'midterm' | 'final' | 'mock' | 'quiz' | 'custom'
  examDate: string              // YYYY-MM-DD
  /** 默认满分（可与每科单独 fullScore 配合使用，新版允许每科满分不同） */
  fullScore?: number
  note?: string
}

/** 成绩录入常用科目（含"其他"自定义） */
export const EXAM_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '地理', '政治', '历史', '其他'] as const
export type ExamSubject = typeof EXAM_SUBJECTS[number]

export interface Grade extends BaseEntity {
  examId: string
  classId: string
  studentId: string
  subject: string               // 自由填写：使用 EXAM_SUBJECTS 或自定义
  score: number
  /** 排名（班级内，按科目），1-based */
  rank?: number | null
  /** 校排名（从 Excel 导入，若提供） */
  schoolRank?: number | null
  /** 学科知识点（物理 / 生物等按学科用），逗号分隔 */
  knowledgePoints?: string
  note?: string
  /** 该科满分（缺省使用 Exam.fullScore） */
  fullScore?: number
}

/* ----------- 作业 ----------- */
export interface Assignment extends BaseEntity {
  classId: string
  subject: string
  title: string
  description?: string
  publishedAt: string
  dueAt: string                 // ISO
  /** 该作业对应的所有学生完成情况（按 studentId 索引） */
  completions: AssignmentCompletion[]
}

export interface AssignmentCompletion {
  studentId: string
  status: 'pending' | 'submitted' | 'late' | 'missing' | 'exempt'
  submittedAt?: string | null
  score?: number | null
  remark?: string
}

/* ----------- 教师待办 ----------- */
/** 子任务（清单内的检查项） */
export interface SubTask {
  id: string
  title: string
  done: boolean
}

export interface Task extends BaseEntity {
  title: string
  content?: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: string | null
  classId?: string | null
  studentId?: string | null
  tags: string[]
  done: boolean
  doneAt?: string | null
  /** 子任务清单（TickTick / 微软 To-Do 风格） */
  subtasks?: SubTask[]
  /** 标星（重要） */
  starred?: boolean
  /** 是否已加入「我的一天」 */
  myDay?: boolean
  /** 手动排序权重（越小越靠前；未设置则排在末尾） */
  order?: number
}

/* ----------- 课程安排 ----------- */
export interface Schedule extends BaseEntity {
  classId: string
  subject: string
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6   // 周一~周日  (1=Mon)
  startTime: string                      // HH:mm
  endTime: string                        // HH:mm
  classroom?: string
  content?: string
  weeks?: number | null                  // 第几周（可选）
}

/* ----------- 课堂记录 ----------- */
export interface ClassNote extends BaseEntity {
  classId: string
  date: string                           // YYYY-MM-DD
  subject: string
  title?: string                         // 标题（如"摩擦力 第一节"）
  content: string                        // 教学内容
  status?: string                        // 课堂状态
  studentBehavior?: string               // 学生表现
  problems?: string                      // 教学问题
  reflection?: string                    // 教学反思
  knowledgePoints: string[]              // 知识点标签
}

/* ----------- 教学反思 ----------- */
export interface Reflection extends BaseEntity {
  date: string                           // YYYY-MM-DD
  classId?: string | null
  subject: string
  chapter?: string
  title: string
  content: string
  tags: string[]
}

/* ----------- 班级事务（仅班主任班使用） ----------- */
export type ClassAffairType =
  | 'meeting'        // 班会
  | 'activity'       // 活动
  | 'notice'         // 通知
  | 'duty'           // 值日
  | 'committee'      // 班委
  | 'task'           // 班级任务
  | 'honor'          // 荣誉
  | 'material'       // 资料
  | 'other'

export interface ClassAffair extends BaseEntity {
  classId: string
  type: ClassAffairType
  title: string
  content?: string
  date?: string | null
  status?: 'open' | 'done' | 'archived'
  studentIds?: string[]
}

/* ----------- 物理知识点（用户自定义，取代硬编码教材目录） ----------- */
export interface KnowledgePoint extends BaseEntity {
  subject: string
  name: string
  parentId?: string | null
  module?: string                       // 模块：力学 / 电学 / ...
  note?: string
}

/* ----------- 行为评价规则（自定义） ----------- */
export interface BehaviorRule extends BaseEntity {
  classId: string                       // '' => 全局默认；非空 => 针对某班级
  key?: string                          // 行为键，如 attendance:absent / assignment:missing
  name: string                          // 规则名称
  score: number                         // 正加负减分值
  category: 'award' | 'demerit' | 'custom'
  description?: string
  isActive: boolean
}

/* ----------- 系统元数据 ----------- */
export interface Meta {
  key: string
  value: any
  updatedAt: string
}

/* ----------- 全局数据快照（用于备份） ----------- */
export interface BackupSnapshot {
  version: number                       // 数据结构版本
  exportedAt: string
  teachers: Teacher[]
  classes: ClassEntity[]
  students: Student[]
  groups: Group[]
  records: StudentRecord[]
  communications: Communication[]
  attendance: Attendance[]
  exams: Exam[]
  grades: Grade[]
  assignments: Assignment[]
  tasks: Task[]
  schedules: Schedule[]
  classNotes: ClassNote[]
  reflections: Reflection[]
  classAffairs: ClassAffair[]
  knowledgePoints: KnowledgePoint[]
  behaviorRules: BehaviorRule[]
  meta: Meta[]
}
