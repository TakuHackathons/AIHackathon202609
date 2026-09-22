import { createFileRoute } from '@tanstack/react-router';
import ResourcesPage from '../../admin/pages/ResourcesPage';
export const Route = createFileRoute('/admin/resources')({ component: ResourcesPage });
