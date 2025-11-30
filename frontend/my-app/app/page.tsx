'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero Section */}
      <header className="bg-blue-600 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Research Paper Submission & Review Platform</h1>
        <p className="text-lg md:text-xl max-w-xl mx-auto">
          Submit, review, and manage research papers efficiently with a secure and collaborative platform.
        </p>
        <div className="mt-6 flex justify-center space-x-4">
          <Link href="/auth/login" className="px-6 py-3 bg-white text-blue-600 font-semibold rounded hover:bg-gray-100 transition">
            Login
          </Link>
          <Link href="/auth/register" className="px-6 py-3 border border-white text-white font-semibold rounded hover:bg-white hover:text-blue-600 transition">
            Register
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Roles & Functionalities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded shadow hover:shadow-lg transition">
            <h3 className="text-xl font-semibold mb-2">Author</h3>
            <p className="text-gray-600">
              Submit new research papers, edit existing papers, track review progress, and download feedback.
            </p>
          </div>
          <div className="bg-white p-6 rounded shadow hover:shadow-lg transition">
            <h3 className="text-xl font-semibold mb-2">Reviewer</h3>
            <p className="text-gray-600">
              Access assigned papers, submit and update reviews, manage existing feedback, and download paper files.
            </p>
          </div>
          <div className="bg-white p-6 rounded shadow hover:shadow-lg transition">
            <h3 className="text-xl font-semibold mb-2">Editor / HR</h3>
            <p className="text-gray-600">
              Oversee formatting and content checks, approve roles, monitor activity logs, and manage user permissions.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-blue-600 text-white py-16 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Get Started Now</h2>
        <p className="mb-6 max-w-xl mx-auto">Join RPSRP and streamline your research paper submissions and reviews today.</p>
        <div className="space-x-4">
          <Link href="/auth/login" className="px-6 py-3 bg-white text-blue-600 font-semibold rounded hover:bg-gray-100 transition">
            Login
          </Link>
          <Link href="/auth/register" className="px-6 py-3 border border-white text-white font-semibold rounded hover:bg-white hover:text-blue-600 transition">
            Register
          </Link>
        </div>
      </section>

      <footer className="py-6 text-center text-gray-500">
        &copy; {new Date().getFullYear()} RPSRP. All rights reserved.
      </footer>
    </div>
  );
}
