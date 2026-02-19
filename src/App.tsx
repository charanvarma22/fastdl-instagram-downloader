
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ToolPage from './pages/ToolPage';
import BlogListPage from './pages/BlogListPage';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-slate-950 text-white flex flex-col">
                <Navbar />
                <main className="flex-grow">
                    <Routes>
                        <Route path="/" element={<HomePage />} />

                        {/* Tool Routes */}
                        <Route path="/reels" element={<ToolPage type="reels" />} />
                        <Route path="/video" element={<ToolPage type="video" />} />
                        <Route path="/photo" element={<ToolPage type="photo" />} />
                        <Route path="/stories" element={<ToolPage type="stories" />} />
                        <Route path="/igtv" element={<ToolPage type="igtv" />} />

                        {/* Blog Routes */}
                        <Route path="/blog" element={<BlogListPage />} />
                        {/* Add BlogDetail page if it exists later */}

                        {/* Fallback */}
                        <Route path="*" element={<HomePage />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
