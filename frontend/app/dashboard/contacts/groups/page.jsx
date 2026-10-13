'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContactGroups from '../../../../components/ContactGroups';

export default function GroupsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/contacts?tab=groups');
  }, [router]);

  return (
    <div className="p-6">
      <ContactGroups />
    </div>
  );
}
