import { useState } from 'react';
import { adminApi } from '../api';
import { useAdmin } from '../AdminContext';
import { PageHeading, remove, useSchoolData } from '../educationShared';
import FacilityOperationsPanel from './FacilityOperationsPanel';

type Facility = { id: number; name: string; category: string; location: string; description: string; currentStatus?: { status: string } };
const blank = { name: '', category: '', location: '', description: '', manualStatus: '' };

export default function FacilitiesPage() {
  const { manager, run, setNotice } = useAdmin();
  const data = useSchoolData<Facility>('facilities', 'facilities');
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [operationsId, setOperationsId] = useState(0);

  const save = () =>
    run(async () => {
      await adminApi(editingId ? 'facilities/' + editingId : 'facilities', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...form, schoolId: data.schoolId }),
      });
      setForm(blank);
      setEditingId(null);
      setNotice('Facility saved.');
      await data.load();
    });

  return (
    <section>
      <PageHeading
        kicker="FACILITIES"
        title="Facilities"
        description="Manage facility details, business hours, exceptions and current status."
      />
      {data.picker}
      {manager && (
        <form
          className="admin-card admin-form admin-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <select value={form.manualStatus} onChange={(event) => setForm({ ...form, manualStatus: event.target.value })}>
            <option value="">Automatic status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="restricted">Restricted</option>
          </select>
          <button className="admin-primary">Save</button>
        </form>
      )}
      <div className="admin-list">
        {data.rows.map((facility) => (
          <article className="admin-card" key={facility.id}>
            <div className="admin-record-heading">
              <h2>{facility.name}</h2>
              <span className={'status-badge ' + (facility.currentStatus?.status ?? 'closed')}>
                {facility.currentStatus?.status ?? 'closed'}
              </span>
            </div>
            <p>
              {facility.category} {facility.location}
            </p>
            <p>{facility.description}</p>
            {manager && (
              <div className="admin-actions">
                <button onClick={() => setOperationsId(facility.id)}>Hours and exceptions</button>
                <button
                  onClick={() => {
                    setEditingId(facility.id);
                    setForm({
                      ...blank,
                      name: facility.name,
                      category: facility.category,
                      location: facility.location,
                      description: facility.description,
                    });
                  }}
                >
                  Edit
                </button>
                <button className="danger" onClick={() => void run(() => remove('facilities/' + facility.id, data.load))}>
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {manager && operationsId > 0 && <FacilityOperationsPanel facilityId={operationsId} />}
    </section>
  );
}
