import { createFileRoute } from '@tanstack/react-router';
import TeacherNewPage from '../../../admin/pages/TeacherNewPage';

export const Route = createFileRoute('/admin/teachers/new')({ component: TeacherNewPage });
