import { BaseRepository } from '../BaseRepository'
import { getDB } from '../index'
import type { Exam, Grade } from '@/types/models'
import type { StoreName } from '../index'

class ExamRepo extends BaseRepository<Exam> {
  store: StoreName = 'exams'

  async listByClass(classId: string): Promise<Exam[]> {
    if (!classId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('exams', 'by-class', classId)) as Exam[]
    return all.filter((e) => !e.deletedAt).sort((a, b) => (a.examDate > b.examDate ? -1 : 1))
  }
}

class GradeRepo extends BaseRepository<Grade> {
  store: StoreName = 'grades'

  async listByExam(examId: string): Promise<Grade[]> {
    if (!examId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('grades', 'by-exam', examId)) as Grade[]
    return all.filter((g) => !g.deletedAt)
  }

  async listByStudent(studentId: string): Promise<Grade[]> {
    if (!studentId) return []
    const db = await getDB()
    const all = (await db.getAllFromIndex('grades', 'by-student', studentId)) as Grade[]
    return all.filter((g) => !g.deletedAt)
  }

  async upsertForStudent(opts: {
    examId: string
    studentId: string
    classId: string
    subject: string
    score: number
    rank?: number | null
    schoolRank?: number | null
    knowledgePoints?: string
    note?: string
    fullScore?: number
  }): Promise<Grade> {
    const db = await getDB()
    const all = (await db.getAllFromIndex('grades', 'by-exam', opts.examId)) as Grade[]
    const existed = all.find(
      (g) => g.studentId === opts.studentId && g.subject === opts.subject && !g.deletedAt,
    )
    if (existed) {
      return this.update(existed.id, {
        score: opts.score,
        rank: opts.rank ?? existed.rank,
        schoolRank: opts.schoolRank ?? existed.schoolRank,
        knowledgePoints: opts.knowledgePoints ?? existed.knowledgePoints,
        note: opts.note ?? existed.note,
        subject: opts.subject,
        fullScore: opts.fullScore ?? existed.fullScore,
      })
    }
    return this.create({
      examId: opts.examId,
      studentId: opts.studentId,
      classId: opts.classId,
      subject: opts.subject,
      score: opts.score,
      rank: opts.rank ?? null,
      schoolRank: opts.schoolRank ?? null,
      knowledgePoints: opts.knowledgePoints ?? '',
      note: opts.note ?? '',
      fullScore: opts.fullScore,
    })
  }

  /** 删除某学生在某考试下的全部成绩（移除学生 / 删除考试时用） */
  async deleteByExamAndStudent(examId: string, studentId: string): Promise<void> {
    const db = await getDB()
    const all = (await db.getAllFromIndex('grades', 'by-exam', examId)) as Grade[]
    for (const g of all) {
      if (g.studentId === studentId && !g.deletedAt) await this.hardDelete(g.id)
    }
  }
}

export const examRepo = new ExamRepo()
export const gradeRepo = new GradeRepo()
