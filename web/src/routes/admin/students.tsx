import { createFileRoute } from '@tanstack/react-router';
import StudentsPage from '../../admin/pages/StudentsPage';
export const Route = createFileRoute('/admin/students')({ component: StudentsPage });
