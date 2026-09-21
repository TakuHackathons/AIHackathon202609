import { createFileRoute } from '@tanstack/react-router';
import SchoolEditPage from '../../../admin/pages/SchoolEditPage';

export const Route = createFileRoute('/admin/schools/edit')({
  validateSearch: (search: Record<string, unknown>) => ({ schoolId: Number(search.schoolId) }),
  component: SchoolEditRoute,
});

function SchoolEditRoute() {
  const { schoolId } = Route.useSearch();
  return <SchoolEditPage schoolId={schoolId} />;
}
