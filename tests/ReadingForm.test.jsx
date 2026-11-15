// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ReadingForm from '../client/src/ReadingForm.jsx';

afterEach(cleanup);

const defaultProps = { today: '2026-11-15', date: '2026-11-15', slot: 'morning_fasting', onCancel: vi.fn() };

function setup(props = {}) {
  const onSave = props.onSave || vi.fn().mockResolvedValue(undefined);
  render(<ReadingForm {...defaultProps} {...props} onSave={onSave} />);
  return onSave;
}

function setValue(value) { fireEvent.change(screen.getByLabelText('Blood glucose'), { target: { value } }); }
function save() { fireEvent.click(screen.getByRole('button', { name: 'Save reading' })); }

describe('Reading form', () => {
  it('explains a missing value and does not submit an empty reading', async () => {
    const onSave = setup();
    save();
    expect(await screen.findByText('Please enter a glucose value.')).toBeVisible();
    expect(screen.getByLabelText('Blood glucose')).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(['39', '601', '110.5'])('rejects invalid whole-number value %s visibly', async (value) => {
    const onSave = setup();
    setValue(value);
    save();
    expect(await screen.findByText('Value must be a whole number between 40 and 600 mg/dl.')).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects a future date even when native date restrictions are bypassed', async () => {
    const onSave = setup();
    setValue('110');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-16' } });
    save();
    expect(await screen.findByText('Date cannot be in the future.')).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits a valid reading with a numeric value and the selected slot', async () => {
    const onSave = setup();
    setValue('40');
    fireEvent.change(screen.getByLabelText('Time slot'), { target: { value: 'after_lunch' } });
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith({ date: '2026-11-15', slot: 'after_lunch', value: 40 }));
  });

  it('preserves an existing reading and permits a no-op edit at the upper boundary', async () => {
    const onSave = setup({ reading: { id: 'existing', date: '2026-11-14', slot: 'after_dinner', value: 600 } });
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-14');
    expect(screen.getByLabelText('Time slot')).toHaveValue('after_dinner');
    expect(screen.getByLabelText('Blood glucose')).toHaveValue(600);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith({ date: '2026-11-14', slot: 'after_dinner', value: 600 }));
  });

  it('shows the server conflict and keeps the entered value available for correction', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('You already have an After lunch reading for this date.'));
    setup({ onSave, slot: 'after_lunch' });
    setValue('125');
    save();
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have an After lunch reading for this date.');
    expect(screen.getByLabelText('Blood glucose')).toHaveValue(125);
    expect(screen.getByRole('button', { name: 'Save reading' })).toBeEnabled();
  });

  it('prevents duplicate submissions and cancellation while saving', async () => {
    let resolveSave;
    const pending = new Promise((resolve) => { resolveSave = resolve; });
    const onSave = setup({ onSave: vi.fn().mockReturnValue(pending) });
    setValue('110');
    save();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByLabelText('Blood glucose')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    resolveSave();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save reading' })).toBeEnabled());
  });

  it('clears a validation message when the user corrects that field', async () => {
    const onSave = setup();
    save();
    expect(await screen.findByText('Please enter a glucose value.')).toBeVisible();
    setValue('105');
    expect(screen.queryByText('Please enter a glucose value.')).not.toBeInTheDocument();
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith({ date: '2026-11-15', slot: 'morning_fasting', value: 105 }));
  });
});
