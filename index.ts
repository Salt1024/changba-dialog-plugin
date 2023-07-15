import { VueConstructor, ComponentInstance } from "vue";
import { MyMap } from "./map";
const RealMap = Map || MyMap;
const metaMap = new RealMap();
const dialogTypeMap = new RealMap();
let dialogInstanceStack: ComponentInstance[] = [];
let activeDialogInstance: ComponentInstance | null = null;

export default {
  install(Vue: VueConstructor) {
    /**
     * 将某个弹窗实例设置为显示
     * @param instance
     */
    const showAnyDialog = (instance: ComponentInstance) => {
      const el = instance.$el as HTMLElement;
      const meta = metaMap.get(instance) as {
        destroy: Boolean;
        display: string;
      };
      el.style.display = meta.display || "block";
    };

    /**
     * 打开一个弹窗
     * @param dialogType
     * @param params
     */
    const openDialog = (dialogType: string, params = {}, events: Record<string, Function> = {}) => {
      // 如果前一个弹窗还活跃，则需要先处理
      if (activeDialogInstance) {
        const { destroy: preDestroy } = metaMap.get(activeDialogInstance) as {
          destroy: Boolean;
          display: string;
        };
        // 确实不销毁， 将之前高亮的弹窗隐藏
        if (preDestroy === false) {
          (activeDialogInstance.$el as HTMLElement).style.display = "none";
          dialogInstanceStack.push(activeDialogInstance);
        } else {
          destroyDialog(false, false);
        }
        activeDialogInstance = null;
      }
      // destroy配置是否销毁弹窗
      let { destroy, ...rest } = Object.assign({ destroy: true }, params);
      let thisInstance: ComponentInstance;
      let oldInstance = dialogTypeMap.get(dialogType);
      // 如果强制创建新的，先将已经存在的旧的删除
      if (!oldInstance) {
        const outlet = document.createElement("div");
        outlet.classList.add("dialog");
        document.body.appendChild(outlet);
        thisInstance = new Vue({
          render: (h) => {
            return h(dialogType, {
              props: rest,
              attrs: rest,
              on: {
                ...events,
                close: closeAllDialog,
              },
            });
          },
        }).$mount(outlet);
        // 设置元数据，再稍后将尝试寻找
        metaMap.set(thisInstance, {
          destroy,
          display: getComputedStyle(thisInstance.$el as HTMLElement).display,
        });
      } else {
        thisInstance = dialogTypeMap.get(dialogType);
        // 把它从不是active弹窗调整到active上去
        dialogInstanceStack = dialogInstanceStack.filter((x) => x !== oldInstance);
        showAnyDialog(thisInstance);
      }
      // 设置或更新弹窗类型
      dialogTypeMap.set(dialogType, thisInstance);
      // 设置当前弹窗为活跃弹窗
      activeDialogInstance = thisInstance;
      return { close: closeDialog, instance: thisInstance };
    };

    /**
     * 关闭弹窗
     * @returns
     */
    const closeDialog = () => {
      if (!activeDialogInstance) {
        console.log("your need hide or destroy dialog instance not exist");
        return;
      }
      // 尝试获取
      let { destroy } = (metaMap.get(activeDialogInstance) || {}) as {
        destroy: Boolean;
        display: string;
      };
      if (typeof destroy === "undefined") {
        destroy = true;
      }
      // 如果需要销毁的话，直接销毁就好，并且要把栈中存储的之前的弹窗打开
      if (destroy) {
        destroyDialog(true);
        // 删除配置的元数据，防止内存泄露
        metaMap.delete(activeDialogInstance);
        dialogTypeMap.delete(activeDialogInstance);
      } else {
        // 将弹窗的DOM隐藏，然后加入到堆栈中去
        const el = activeDialogInstance.$el as HTMLElement;
        el.style.display = "none";
        dialogInstanceStack.push(activeDialogInstance);
        activeDialogInstance = null;
      }
    };

    /**
     * 销毁当前的活跃弹窗，是否需要自动填充前一个弹窗，是否展示前面一个弹窗
     * @returns
     */
    const destroyDialog = (showPreDialog: boolean, extractPreDialogToFill = true) => {
      if (!activeDialogInstance) {
        console.log("your need hide or destroy dialog instance not exist");
        return;
      }
      activeDialogInstance.$destroy();
      document.body.removeChild(activeDialogInstance.$el);
      if (dialogInstanceStack.length && extractPreDialogToFill) {
        activeDialogInstance = dialogInstanceStack.pop()!;
        // 将当前活跃的弹窗显示为活跃
        if (showPreDialog) {
          showAnyDialog(activeDialogInstance);
        }
      }
    };

    /**
     * 关闭所有弹窗
     */
    const closeAllDialog = () => {
      while (activeDialogInstance) {
        destroyDialog(false);
      }
    };

    Vue.prototype.$closeAllDialog = closeAllDialog;
    Vue.prototype.$closeDialog = closeDialog;
    Vue.prototype.$openDialog = openDialog;
  },
};
