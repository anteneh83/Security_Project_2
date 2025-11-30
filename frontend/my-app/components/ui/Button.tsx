'use client';
export default function Button({ children, ...rest }: any) {
return <button className="px-4 py-2 bg-blue-600 text-white rounded" {...rest}>{children}</button>;
}