import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, postsRes] = await Promise.all([
        fetch('http://localhost:8080/api/stats'),
        fetch('http://localhost:8080/api/users'),
        fetch('http://localhost:8080/api/posts')
      ])

      const statsData = await statsRes.json()
      const usersData = await usersRes.json()
      const postsData = await postsRes.json()

      setStats(statsData)
      setUsers(usersData.users || [])
      setPosts(postsData.posts || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="App">Loading...</div>
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>txiki.js + React Demo</h1>
        <p>A full-stack application with Express-lite and React</p>
      </header>
      
      <main className="App-main">
        <section className="stats-section">
          <h2>Statistics</h2>
          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Users</h3>
                <p className="stat-number">{stats.users}</p>
              </div>
              <div className="stat-card">
                <h3>Posts</h3>
                <p className="stat-number">{stats.posts}</p>
              </div>
            </div>
          )}
        </section>

        <section className="data-section">
          <h2>Users</h2>
          <div className="data-grid">
            {users.map(user => (
              <div key={user.id} className="data-card">
                <h3>{user.name}</h3>
                <p>{user.email}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="data-section">
          <h2>Posts</h2>
          <div className="posts-list">
            {posts.map(post => (
              <div key={post.id} className="post-card">
                <h3>{post.title}</h3>
                <p>{post.content}</p>
                <small>User ID: {post.userId}</small>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
