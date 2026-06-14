import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

import { HomePage } from '../pages/home/HomePage'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'

import { VacancyDetailPage } from '../pages/detailpages/VacancyDetailPage'
import { CompanyDetailPage } from '../pages/detailpages/CompanyDetailPage'

import { ApplicantPage } from '../pages/applicant/ApplicantrPage'
import { ApplicantProfilePage } from '../pages/applicant/ApplicantProfilePage'
import { ApplicantFavoritesPage } from '../pages/applicant/ApplicantFavoritesPage'
import { CreateResumePage } from '../pages/applicant/CreateResumePage'
import { ResumeDetailsPage } from '../pages/applicant/ResumeDetailsPage'

import { MyApplicationsPage } from '../pages/applications/MyApplicationsPage'

import { AdminPage } from '../pages/admin/AdminPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'

import { RequireAuth } from '../shared/auth/RequireAuth'

import { VacanciesPage } from '../pages/public/VacanciesPage'
import { CompaniesPage } from '../pages/public/CompaniesPage'

import { EmployerVacanciesPage } from '../pages/employer/EmployerVacanciesPage'
import { CreateVacancyPage } from '../pages/employer/CreateVacancyPage'
import { EmployerVacancyDetailsPage } from '../pages/employer/EmployerVacancyDetailsPage'
import { EmployerCompanyProfilePage } from '../pages/employer/EmployerCompanyProfilePage'
import { CompanyApplicationsPage } from '../pages/employer/CompanyApplicationsPage.tsx'

import { EmployerCandidateResumeDetailsPage } from '../pages/resumes/EmployerCandidateResumeDetailsPage'

import { ChatPage } from '../pages/chat/ChatPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Outlet />,
    children: [
      { index: true, element: <HomePage /> },

      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'admin/login', element: <AdminLoginPage /> },

      { path: 'vacancies', element: <VacanciesPage /> },
      { path: 'vacancies/:vacancyId', element: <VacancyDetailPage /> },

      { path: 'companies', element: <CompaniesPage /> },
      { path: 'companies/:companyId', element: <CompanyDetailPage /> },

      {
        element: <RequireAuth allowedRoles={['applicant', 'company']} />,
        children: [{ path: 'chat', element: <ChatPage /> }],
      },

      {
        element: <RequireAuth allowedRoles={['applicant']} />,
        children: [
          { path: 'applicant', element: <ApplicantPage /> },
          { path: 'applicant/resume/create', element: <CreateResumePage /> },
          { path: 'applicant/resume/:resumeId', element: <ResumeDetailsPage /> },
          { path: 'applicant/resume/:resumeId/edit', element: <ResumeDetailsPage /> },
          { path: 'responses', element: <MyApplicationsPage /> },
          { path: 'applicant/profile', element: <ApplicantProfilePage /> },
          { path: 'applicant/favorites', element: <ApplicantFavoritesPage /> },
          { path: 'applicant/chat', element: <ChatPage /> },
        ],
      },

      {
        element: <RequireAuth allowedRoles={['company']} />,
        children: [
          { path: 'employer/vacancies', element: <EmployerVacanciesPage /> },
          { path: 'employer/vacancies/create', element: <CreateVacancyPage /> },
          { path: 'employer/vacancies/:vacancyId', element: <EmployerVacancyDetailsPage /> },
          { path: 'employer/company-profile', element: <EmployerCompanyProfilePage /> },
          {
            path: 'employer/candidates/resumes/:resumeId',
            element: <EmployerCandidateResumeDetailsPage />,
          },
          { path: 'employer/applications', element: <CompanyApplicationsPage /> },
          { path: 'employer/chat', element: <ChatPage /> },
        ],
      },

      {
        element: <RequireAuth allowedRoles={['admin']} />,
        children: [{ path: 'admin', element: <AdminPage /> }],
      },
    ],
  },
])

export const AppRouter = () => {
  return (
    <RouterProvider
      router={router}
      future={{ v7_startTransition: true }}
    />
  )
}