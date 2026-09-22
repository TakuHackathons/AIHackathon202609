import { createFileRoute } from '@tanstack/react-router';
import FacilitiesPage from '../../admin/pages/FacilitiesPage';
export const Route = createFileRoute('/admin/facilities')({ component: FacilitiesPage });
