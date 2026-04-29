import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function FacultyPerformance({ data, periodRange, setPeriodRange }) {
  return (
    <div className="faculty-performance">
      <div className="faculty-performance-header">
        <h2>Statistika akademike</h2>
        <select
          value={periodRange}
          onChange={(e) => setPeriodRange(e.target.value)}
          className="faculty-performance-select"
        >
          <option value="1m">1 muaj</option>
          <option value="2m">2 muaj</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Publikime" fill="#8884d8" />
          <Bar dataKey="Konferenca" fill="#82ca9d" />
          <Bar dataKey="Citime" fill="#ffc658" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}