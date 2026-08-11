'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Plus, Edit2, Trash2, Save } from 'lucide-react';
import { useState } from 'react';

interface KeyPerson {
  id: number;
  name: string;
  title: string;
  gender: string;
  age: number;
  hometown: string;
  personality: string;
  weakness: string;
  category: string;
}

export default function KeyPersonsPage() {
  const router = useRouter();
  const [persons, setPersons] = useState<KeyPerson[]>([
    { id: 1, name: '王浩', title: '一线办事员', gender: '男', age: 32, hometown: '山东济南', personality: '4种性格随机刷新', weakness: '多为工作减负、绩效加分、个人业余爱好', category: '一线' },
    { id: 2, name: '刘凯', title: '采购专员', gender: '男', age: 36, hometown: '江苏徐州', personality: '老虎/孔雀为主', weakness: '评优晋升、家庭育儿需求', category: '一线' },
    { id: 3, name: '陈建国', title: '业务部部长', gender: '男', age: 47, hometown: '河南洛阳', personality: '老虎型', weakness: '职称评级、行业个人口碑、子女升学', category: '中层' },
    { id: 4, name: '赵峰', title: '分管业务副主任', gender: '男', age: 44, hometown: '河北保定', personality: '老虎型，年富力强', weakness: '政绩考核、新项目落地成果', category: '高层' },
  ]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPerson, setNewPerson] = useState<Partial<KeyPerson>>({
    name: '',
    title: '',
    gender: '男',
    age: 35,
    hometown: '',
    personality: '',
    weakness: '',
    category: '一线',
  });

  const handleEdit = (person: KeyPerson) => {
    setEditingId(person.id);
    setNewPerson(person);
  };

  const handleSave = () => {
    if (editingId) {
      setPersons(persons.map(p => p.id === editingId ? { ...newPerson as KeyPerson } : p));
      setEditingId(null);
    } else {
      setPersons([...persons, { ...newPerson as KeyPerson, id: Date.now() }]);
      setShowAddModal(false);
    }
    setNewPerson({ name: '', title: '', gender: '男', age: 35, hometown: '', personality: '', weakness: '', category: '一线' });
  };

  const handleDelete = (id: number) => {
    setPersons(persons.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="h-14 border-b border-border bg-card px-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/designer')}
          className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">关键人信息</h1>
      </header>

      <main className="p-6">
        {/* 添加按钮 */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加关键人
          </button>
        </div>

        {/* 人员列表 */}
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">职务</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">性别</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">年龄</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">籍贯</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">性格</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">软肋</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">层级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {persons.map((person) => (
                <tr key={person.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-foreground">{person.name}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{person.title}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{person.gender}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{person.age}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{person.hometown}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{person.personality}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{person.weakness}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      person.category === '高层' ? 'bg-error/10 text-error' :
                      person.category === '中层' ? 'bg-warning/10 text-warning' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {person.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(person)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(person.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 添加/编辑弹窗 */}
        {(showAddModal || editingId) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingId ? '编辑关键人' : '添加关键人'}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">姓名</label>
                    <input
                      type="text"
                      value={newPerson.name}
                      onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                      className="w-full h-10 px-4 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">职务</label>
                    <input
                      type="text"
                      value={newPerson.title}
                      onChange={(e) => setNewPerson({ ...newPerson, title: e.target.value })}
                      className="w-full h-10 px-4 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">性别</label>
                    <select
                      value={newPerson.gender}
                      onChange={(e) => setNewPerson({ ...newPerson, gender: e.target.value })}
                      className="w-full h-10 px-4 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">年龄</label>
                    <input
                      type="number"
                      value={newPerson.age}
                      onChange={(e) => setNewPerson({ ...newPerson, age: parseInt(e.target.value) })}
                      className="w-full h-10 px-4 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">籍贯</label>
                    <input
                      type="text"
                      value={newPerson.hometown}
                      onChange={(e) => setNewPerson({ ...newPerson, hometown: e.target.value })}
                      className="w-full h-10 px-4 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">层级</label>
                    <select
                      value={newPerson.category}
                      onChange={(e) => setNewPerson({ ...newPerson, category: e.target.value })}
                      className="w-full h-10 px-4 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="高层">高层</option>
                      <option value="中层">中层</option>
                      <option value="一线">一线</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">性格</label>
                  <textarea
                    value={newPerson.personality}
                    onChange={(e) => setNewPerson({ ...newPerson, personality: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground text-sm resize-none focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">软肋</label>
                  <textarea
                    value={newPerson.weakness}
                    onChange={(e) => setNewPerson({ ...newPerson, weakness: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-muted border border-border text-foreground text-sm resize-none focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => { setShowAddModal(false); setEditingId(null); }}
                  className="h-10 px-4 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
