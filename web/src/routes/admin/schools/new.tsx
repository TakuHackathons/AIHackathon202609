import { createFileRoute } from '@tanstack/react-router';
import SchoolNewPage from '../../../admin/pages/SchoolNewPage';

export const Route = createFileRoute('/admin/schools/new')({ component: SchoolNewPage });
