export function GroupMembers({
  members,
}: {
  members: { firstName: string }[];
}) {
  return (
    <section className="plan-box plan-group-members">
      <div className="plan-section-head">
        <h2>Your group</h2>
        <span>
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>
      <ul>
        {members.map((member, index) => (
          <li key={`${member.firstName}-${index}`}>
            <span aria-hidden="true">
              {Array.from(member.firstName)[0]?.toUpperCase()}
            </span>
            {member.firstName}
          </li>
        ))}
      </ul>
    </section>
  );
}
