import React from "react";

export default function StatsCards({ title, stats }) {
  return (
    <section className="pr-section">
      {title && <h3 className="pr-section-title">{title}</h3>}

      <div className="pr-stats-grid">
        {stats.map((stat, index) => (
          <div className="pr-stat-card" key={index}>
            <div className="pr-stat-top">
              <div>
                <p className="pr-stat-title">{stat.title}</p>
                <h2>{stat.value}</h2>
              </div>
              <div className="pr-stat-icon">{stat.icon}</div>
            </div>
            <p className="pr-stat-change">{stat.change}</p>
          </div>
        ))}
      </div>
    </section>
  );
}