'use client';
import Link from 'next/link';


export default function PaperCard({ paper }: any) {
return (
<div className="border rounded p-4 bg-white">
<h3 className="font-semibold">{paper.title}</h3>
<p className="text-sm text-gray-600">{paper.abstract}</p>
<div className="mt-2 flex gap-2">
<Link href={`/dashboard/papers/${paper._id}`} className="text-blue-600">View</Link>
</div>
</div>
);
}