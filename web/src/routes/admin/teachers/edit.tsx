import { createFileRoute } from '@tanstack/react-router';
import TeacherEditPage from '../../../admin/pages/TeacherEditPage';

export const Route = createFileRoute('/admin/teachers/edit')({
  validateSearch: (search: Record<string, unknown>) => ({ teacherId: Number(search.teacherId) }),
  component: TeacherEditRoute,
});

function TeacherEditRoute() {
  const { teacherId } = Route.useSearch();
  return <TeacherEditPage teacherId={teacherId} />;
}
