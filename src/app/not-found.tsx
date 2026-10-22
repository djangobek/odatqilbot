import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-lg font-semibold">Sahifa topilmadi</p>
        <Link href="/today" className="mt-3 inline-block text-accent">Bosh sahifaga qaytish</Link>
      </div>
    </main>
  );
}
