"use client";
import ClientApp from "./ClientApp";

export default function Page(){
  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Wheel Picker</h1>
        <p className="text-gray-600">Spin the wheel to make random decisions</p>
      </div>
      <ClientApp />
    </div>
  );
}