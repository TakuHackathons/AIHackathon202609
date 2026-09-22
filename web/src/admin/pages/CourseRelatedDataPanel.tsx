import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';

type Detail = {
  enrollments: Array<{ id: number; studentId: number; status: string }>;
  assignments: Array<{ id: number; title: string; description: string; dueAt: number | null; externalUrl: string }>;
  exceptions: Array<{ id: number; date: string; kind: string; note: string }>;
};
type Student = { id: number; studentNumber: string };
const assignmentBlank = { title: '', description: '', dueAt: '', externalUrl: '' };

export default function CourseRelatedDataPanel({ courseId, schoolId }: { courseId: number; schoolId: number }) {
  const { run, setNotice } = useAdmin();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(0);
  const [assignment, setAssignment] = useState(assignmentBlank);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [exception, setException] = useState({ date: '', kind: 'cancelled', startsAt: '', endsAt: '', note: '' });

  const load = async () => {
    const [course, studentData] = await Promise.all([adminApi('courses/' + courseId), adminApi('students?schoolId=' + schoolId)]);
    setDetail(course);
    setStudents(studentData.students);
  };
  useEffect(() => {
    void load();
  }, [courseId, schoolId]);

  const enroll = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/enrollments', { method: 'POST', body: JSON.stringify({ studentId }) });
      setNotice('Student enrolled.');
      await load();
    });
  const saveAssignment = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/assignments' + (editingAssignmentId ? '/' + editingAssignmentId : ''), {
        method: editingAssignmentId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...assignment, dueAt: assignment.dueAt ? new Date(assignment.dueAt).getTime() : null }),
      });
      setAssignment(assignmentBlank);
      setEditingAssignmentId(null);
      setNotice('Assignment saved.');
      await load();
    });
  const addException = () =>
    run(async () => {
      await adminApi('courses/' + courseId + '/exceptions', { method: 'POST', body: JSON.stringify(exception) });
      setException({ date: '', kind: 'cancelled', startsAt: '', endsAt: '', note: '' });
      setNotice('Schedule exception saved.');
      await load();
    });
  const remove = (path: string) =>
    run(async () => {
      await adminApi(path, { method: 'DELETE' });
      await load();
    });

  return (
    <section className="admin-card course-planning">
      <h2>Students, assignments and schedule exceptions</h2>
      <h3>Enrolled students</h3>
      <div className="admin-grid">
        <select value={studentId} onChange={(event) => setStudentId(Number(event.target.value))}>
          <option value={0}>Student</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.studentNumber}
            </option>
          ))}
        </select>
        <button disabled={!studentId} onClick={() => void enroll()}>
          Enroll
        </button>
      </div>
      <div className="compact-list">
        {detail?.enrollments.map((item) => (
          <span key={item.id}>
            Student #{item.studentId} / {item.status}
            <button className="danger" onClick={() => void remove('courses/' + courseId + '/enrollments/' + item.id)}>
              Remove
            </button>
          </span>
        ))}
      </div>
      <hr />
      <h3>Assignments</h3>
      <div className="admin-grid">
        <input
          placeholder="Title"
          value={assignment.title}
          onChange={(event) => setAssignment({ ...assignment, title: event.target.value })}
        />
        <input
          type="datetime-local"
          value={assignment.dueAt}
          onChange={(event) => setAssignment({ ...assignment, dueAt: event.target.value })}
        />
        <input
          placeholder="External URL"
          value={assignment.externalUrl}
          onChange={(event) => setAssignment({ ...assignment, externalUrl: event.target.value })}
        />
        <textarea
          placeholder="Description"
          value={assignment.description}
          onChange={(event) => setAssignment({ ...assignment, description: event.target.value })}
        />
        <button disabled={!assignment.title} onClick={() => void saveAssignment()}>
          Save assignment
        </button>
      </div>
      <div className="compact-list">
        {detail?.assignments.map((item) => (
          <span key={item.id}>
            {item.title} {item.dueAt ? new Date(item.dueAt).toLocaleString() : ''}
            <button
              onClick={() => {
                setEditingAssignmentId(item.id);
                setAssignment({
                  title: item.title,
                  description: item.description,
                  dueAt: item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 16) : '',
                  externalUrl: item.externalUrl,
                });
              }}
            >
              Edit
            </button>
            <button className="danger" onClick={() => void remove('courses/' + courseId + '/assignments/' + item.id)}>
              Delete
            </button>
          </span>
        ))}
      </div>
      <hr />
      <h3>Date-specific schedule exceptions</h3>
      <div className="admin-grid">
        <input type="date" value={exception.date} onChange={(event) => setException({ ...exception, date: event.target.value })} />
        <select value={exception.kind} onChange={(event) => setException({ ...exception, kind: event.target.value })}>
          <option value="cancelled">Cancelled</option>
          <option value="makeup">Makeup</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="room_changed">Room changed</option>
        </select>
        <input type="time" value={exception.startsAt} onChange={(event) => setException({ ...exception, startsAt: event.target.value })} />
        <input type="time" value={exception.endsAt} onChange={(event) => setException({ ...exception, endsAt: event.target.value })} />
        <input placeholder="Note" value={exception.note} onChange={(event) => setException({ ...exception, note: event.target.value })} />
        <button disabled={!exception.date} onClick={() => void addException()}>
          Add exception
        </button>
      </div>
      <div className="compact-list">
        {detail?.exceptions.map((item) => (
          <span key={item.id}>
            {item.date} / {item.kind} / {item.note}
            <button className="danger" onClick={() => void remove('courses/' + courseId + '/exceptions/' + item.id)}>
              Delete
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
