import { createFileRoute } from '@tanstack/react-router';
import CoursesPage from '../../admin/pages/CoursesPage';
export const Route = createFileRoute('/admin/courses')({ component: CoursesPage });
