
export type MessageRole = 'user' | 'assistant';
export type UserRole = 'patient' | 'doctor' | 'admin';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface PatientProfile {
  birthDate: string;
  initialElement: string; // ธาตุเจ้าเรือน
  chronicDisease: string;
  allergies: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  profile?: PatientProfile;
}

export interface PatientData {
  name: string;
  age: string;
  gender: string;
  weather: string;
  timeOfDay: string;
  mainSymptom: string;
  painLocation: string;
  sensation: string;
  redFlags: string[];
}

export enum Step {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  DASHBOARD = 'DASHBOARD',
  PROFILE = 'PROFILE',
  SAMUTTHAN = 'SAMUTTHAN',
  SYMPTOMS = 'SYMPTOMS',
  RED_FLAGS = 'RED_FLAGS',
  ANALYSIS = 'ANALYSIS',
  BOOKING = 'BOOKING'
}

export interface Availability {
  date: string;
  slots: string[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  image: string;
  availability: Availability[];
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  time: string;
  date: string;
  status: 'pending' | 'requested_by_doctor' | 'confirmed' | 'completed' | 'cancelled';
  attendance?: 'attended' | 'missed' | 'none';
  report?: string;
}
