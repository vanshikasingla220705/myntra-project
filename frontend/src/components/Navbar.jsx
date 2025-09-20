import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { performTextSearch } from '../api/apiService';
import './Navbar.css';

const Navbar = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { setIsLoading, setSearchResults, setError } = useSearch();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    navigate('/recommendations'); // Navigate to recommendations page immediately

    try {
      const { data } = await performTextSearch(searchQuery);
      if (data.success) {
        setSearchResults(data);
      } else {
        setError(data.error || 'Failed to get recommendations.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during search.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="nav-logo">Myntra AI</Link>
      </div>
      <div className="nav-center">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            className="search-bar"
            placeholder="AI Search for outfits, decor, and more..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>
      <div className="nav-right">
        <Link to="/cart-styling" className="nav-link">Cart</Link>
        <div className="profile-menu">
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="profile-btn">
            Profile
          </button>
         
          {dropdownOpen && (
            <div className="dropdown-content">
              <p>Personalised Shopping</p>
              <Link to="/clothing-analyzer" onClick={() => setDropdownOpen(false)}>Clothing</Link>
              <Link to="/decor-analyzer" onClick={() => setDropdownOpen(false)}>Decor</Link>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
              <Link to="/contest" onClick={() => setDropdownOpen(false)}>Style Contest</Link> {/* <-- ADD THIS LINE */}
            </div>
          )}

        </div>
      </div>
    </nav>
  );
};

export default Navbar;