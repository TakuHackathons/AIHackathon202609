import { createFileRoute } from '@tanstack/react-router';
import TeachersPage from '../../../admin/pages/TeachersPage';

export const Route = createFileRoute('/admin/teachers/')({ component: TeachersPage });
