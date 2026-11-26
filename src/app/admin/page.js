import { permanentRedirect } from 'next/navigation';

export default function AdminPage() {
  permanentRedirect('/staff/admin');
}
