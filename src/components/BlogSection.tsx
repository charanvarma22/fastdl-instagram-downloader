
import React, { useState, useEffect } from 'react';
import { ArrowRight, Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  date: string;
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string }>;
    author?: Array<{ name: string }>;
  };
}

interface BlogSectionProps {
  limit?: number;
  showHeading?: boolean;
}

const BlogSection: React.FC<BlogSectionProps> = ({ limit = 3, showHeading = true }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch(`/api/blog/posts?_embed&per_page=${limit}`);
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        const data = await response.json();
        setPosts(data);
      } catch (err) {
        console.error('Error fetching blog posts:', err);
        setError('Could not load latest updates.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [limit]);

  if (error) return null;

  return (
    <section className="py-24 bg-slate-950 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4">
        {showHeading && (
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">Latest Insights</h2>
            <p className="text-slate-400">Updates from the world of social media.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article key={post.id} className="bg-slate-900/40 rounded-[2rem] border border-slate-800 overflow-hidden hover:border-pink-500/30 transition-all group flex flex-col">
                <div className="aspect-video bg-slate-800 relative overflow-hidden">
                  {post._embedded?.['wp:featuredmedia']?.[0]?.source_url ? (
                    <img
                      src={post._embedded['wp:featuredmedia'][0].source_url}
                      alt={post.title.rendered}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-slate-700">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center gap-4 text-xs font-bold text-pink-500 mb-4 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4 line-clamp-2" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                  <div className="text-slate-400 text-sm mb-6 line-clamp-3 flex-grow" dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />
                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-white font-bold hover:text-pink-500 transition-colors mt-auto"
                  >
                    Read Article <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BlogSection;
