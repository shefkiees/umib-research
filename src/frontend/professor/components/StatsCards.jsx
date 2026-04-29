import React from "react";

export default function StatsCards({ stats }) {
  return (
    <div className="stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div className="stat-card" key={stat.id}>
            <div className="stat-info">
              <span className="stat-label">{stat.title}</span>
              <h2 className="stat-value">{stat.value}</h2>
              <p className="stat-change">{stat.change}</p>
            </div>
            <div className="stat-icon-bg">
              <Icon size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
