import { useState } from 'react';
import { CalendarDays, Droplet, LoaderCircle } from 'lucide-react';
import { SLOTS, validateReading } from '../../shared/domain.js';

export default function ReadingForm({ reading, date, slot, today, onSave, onCancel }) {
  const [values, setValues] = useState({ date: reading?.date || date || today, slot: reading?.slot || slot || SLOTS[0].value, value: reading?.value == null ? '' : String(reading.value) });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setFields((current) => ({ ...current, [field]: undefined }));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const payload = { ...values, value: values.value.trim() === '' ? '' : Number(values.value) };
    const invalid = validateReading(payload, today);
    setFields(invalid);
    setError('');
    if (Object.keys(invalid).length) return;
    setSaving(true);
    try {
      await onSave(payload);
    } catch (failure) {
      setFields(failure.fields || {});
      setError(failure.message || 'We couldn’t save your reading. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return <form className="reading-form" onSubmit={submit} noValidate>
    <div className="form-row">
      <div className="field">
        <label htmlFor="reading-date">Date</label>
        <div className="input-icon"><CalendarDays size={17} /><input id="reading-date" type="date" value={values.date} max={today} disabled={saving} onChange={(event) => change('date', event.target.value)} aria-invalid={Boolean(fields.date)} aria-describedby={fields.date ? 'date-error' : undefined} /></div>
        {fields.date && <p className="field-error" id="date-error">{fields.date}</p>}
      </div>
      <div className="field">
        <label htmlFor="reading-slot">Time slot</label>
        <select id="reading-slot" value={values.slot} disabled={saving} onChange={(event) => change('slot', event.target.value)} aria-invalid={Boolean(fields.slot)} aria-describedby={fields.slot ? 'slot-error' : undefined}>
          {SLOTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {fields.slot && <p className="field-error" id="slot-error">{fields.slot}</p>}
      </div>
    </div>
    <div className="field glucose-field">
      <label htmlFor="reading-value">Blood glucose</label>
      <div className="glucose-input"><Droplet size={23} /><input id="reading-value" type="number" inputMode="numeric" placeholder="e.g. 110" min="40" max="600" step="1" value={values.value} disabled={saving} onChange={(event) => change('value', event.target.value)} aria-invalid={Boolean(fields.value)} aria-describedby={fields.value ? 'value-help value-error' : 'value-help'} autoFocus /><span>mg/dl</span></div>
      <p className="field-hint" id="value-help">Enter a whole number between 40 and 600.</p>
      {fields.value && <p className="field-error" id="value-error">{fields.value}</p>}
    </div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving && <LoaderCircle size={17} className="spin" />}{saving ? 'Saving…' : reading ? 'Save changes' : 'Save reading'}</button></div>
  </form>;
}
