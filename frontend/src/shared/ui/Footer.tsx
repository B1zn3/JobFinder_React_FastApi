import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'

export const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__main">
          <div className="footer__brand">
            <Link to="/" className="footer__logo">
              JobFinder
            </Link>
            <p className="footer__tagline">
              Найди работу мечты
            </p>
          </div>

          <div className="footer__links">
            <div className="footer__links-column">
              <h4>Контакты</h4>
              <a href="mailto:kuprianevgenij75@gmail.com">
                kuprianevgenij75@gmail.com
              </a>
              <a href="tel:+375295608177">
                +375 (29) 560-81-77
              </a>
              <p className="footer__muted">
                Пн–Пт, 9:00–18:00
              </p>
            </div>

            <div className="footer__links-column">
              <h4>Мы в соцсетях</h4>
              <a
                href="https://web.telegram.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
              <a
                href="https://www.instagram.com/enemykor/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
              <a
                href="https://www.linkedin.com/in/evgenij-kuprian-4500283b5/"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            </div>

            <div className="footer__links-column">
              <h4>О JobFinder</h4>
              <p className="footer__about">
                Помогаем соискателям находить работу, а компаниям — сотрудников
                с 2026 года. Более 5000 успешных размещений.
              </p>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__copyright">
            © {new Date().getFullYear()} JobFinder. Все права защищены.
          </div>

          <button onClick={scrollToTop} className="footer__back-to-top">
            Наверх ↑
          </button>
        </div>
      </div>
    </footer>
  )
}