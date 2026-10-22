import { redirect } from 'next/navigation';

// The month calendar now lives inside the Today page; old links keep working.
export default function CalendarRedirect() {
  redirect('/today');
}
