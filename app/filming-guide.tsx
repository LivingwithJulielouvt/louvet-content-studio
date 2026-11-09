"use client";
import { useState } from "react";
import { Check, Smartphone, Clock } from "lucide-react";
import { filmingGuide } from "../lib/client-experience.mjs";
type Row = Record<string, any>;
export default function FilmingGuide({
  content,
  config,
  stepAction,
}: {
  content: Row;
  config: Row;
  /** Action affichée sous chaque étape (ex. « Ajouter ma vidéo »). Sans elle : une simple case à cocher. */
  stepAction?: (index: number) => React.ReactNode;
}) {
  const guide = filmingGuide(content, config),
    [recorded, setRecorded] = useState<number[]>([]);
  return (
    <section className="filming-guide" lang={guide.language}>
      <h3>
        <Smartphone size={20} />
        {guide.title}
      </h3>
      <p>{guide.intro}</p>
      <div className="filming-setup">
        <h4>{guide.before}</h4>
        <ol>
          {guide.setup.map((s: string) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      <div className="filming-steps">
        {guide.steps.map((step: Row) => (
          <article className={"filming-step " + (recorded.includes(step.number) ? "done" : "")} key={step.number}>
            <div className="section-heading">
              <h4>
                <span className="step-number">{step.number}</span>
                {guide.step} {step.number}
              </h4>
              <span className="filming-duration">
                <Clock size={15} />
                {step.seconds} {guide.seconds}
              </span>
            </div>
            <dl>
              <dt>{guide.action}</dt>
              <dd>{step.action}</dd>
              {step.say && (
                <>
                  <dt>
                    {guide.language === "es"
                      ? "Lo que puedes decir"
                      : guide.language === "en"
                        ? "Words you can say"
                        : "Les mots que vous pouvez dire"}
                  </dt>
                  <dd>« {step.say} »</dd>
                </>
              )}
              <dt>{guide.place}</dt>
              <dd>{step.position}</dd>
            </dl>
            <p className="filming-record">{guide.finish}</p>
            {stepAction ? (
              stepAction(step.number - 1)
            ) : (
            <label className="filming-check">
              <input
                type="checkbox"
                checked={recorded.includes(step.number)}
                onChange={() =>
                  setRecorded(
                    recorded.includes(step.number)
                      ? recorded.filter((n) => n !== step.number)
                      : [...recorded, step.number],
                  )
                }
              />
              <Check size={16} />
              {guide.language === "es"
                ? "Ya grabé este video"
                : guide.language === "en"
                  ? "I recorded this video"
                  : "J’ai filmé cette petite vidéo"}
            </label>
            )}
          </article>
        ))}
      </div>
      {!stepAction && <p className="filming-next">{guide.next}</p>}
      <small>{guide.help}</small>
    </section>
  );
}
