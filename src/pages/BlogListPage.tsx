
import React from 'react';
import BlogSection from '../components/BlogSection';

const BlogListPage: React.FC = () => {
  return (
    <div className="pt-12">
      <div className="max-w-7xl mx-auto px-4 text-center mb-16">
        <h1 className="text-5xl font-extrabold mb-4">InstamInsta <span className="insta-text-gradient">Blog</span></h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">Tips, tricks, and the latest news from the world of Instagram marketing and content creation.</p>
      </div>
      <BlogSection />
    </div>
  );
};

export default BlogListPage;
